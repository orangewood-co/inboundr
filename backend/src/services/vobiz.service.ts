import crypto from "node:crypto";

import { getVobizConfig, isVobizConfigured } from "../config/telephony.config";
import { CallSession, type ICallSession } from "../models/call-session.model";
import { TicketMessage } from "../models/ticket-message.model";
import { Ticket } from "../models/ticket.model";
import { createUploadKey, fileUrlForKey, putObjectBuffer } from "./storage.service";
import { broadcastMessageCreated, broadcastTicketUpdate } from "./support-ws.service";
import { serializeTicket } from "./ticket.service";

interface VobizCallbackInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

function parseBody(rawBody: string): Record<string, any> {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to form parsing
    }
  }
  const params = new URLSearchParams(trimmed);
  const result: Record<string, string> = {};
  for (const [key, value] of params) result[key] = value;
  return result;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string {
  const raw = headers[name.toLowerCase()];
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
}

/**
 * Verifies the Vobiz callback HMAC. Vobiz signs the raw body with the webhook
 * secret and sends the signature in X-Vobiz-Signature-V2 / V3 headers. When no
 * secret is configured, verification is skipped.
 */
export function verifyVobizSignature(input: VobizCallbackInput): boolean {
  const { webhookSecret } = getVobizConfig();
  if (!webhookSecret) return true;

  const provided = [
    headerValue(input.headers, "x-vobiz-signature-v3"),
    headerValue(input.headers, "x-vobiz-signature-v2"),
    headerValue(input.headers, "x-vobiz-signature"),
  ].filter(Boolean);
  if (provided.length === 0) return false;

  const digestBase64 = crypto
    .createHmac("sha256", webhookSecret)
    .update(input.rawBody, "utf8")
    .digest("base64");
  const digestHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(input.rawBody, "utf8")
    .digest("hex");

  return provided.some((signature) => {
    const candidate = signature.includes(",") ? signature.split(",").pop()!.trim() : signature.trim();
    return candidate === digestBase64 || candidate === digestHex;
  });
}

function pickString(body: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeNumber(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

async function correlateCallSession(body: Record<string, any>): Promise<ICallSession | null> {
  const callUuid = pickString(body, ["CallUUID", "call_uuid", "callUuid"]);
  const sipCallId = pickString(body, ["SipCallId", "sip_call_id", "Call-ID", "CallId"]);
  const from = normalizeNumber(pickString(body, ["From", "from", "Caller", "caller_id"]));

  if (callUuid) {
    const byUuid = await CallSession.findOne({ vobizCallUuid: callUuid });
    if (byUuid) return byUuid;
  }
  if (sipCallId) {
    const bySip = await CallSession.findOne({ sipCallId });
    if (bySip) return bySip;
  }
  // Fallback: most recent call from this caller awaiting a recording.
  if (from) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const byCaller = await CallSession.findOne({
      callerNumber: from,
      recordingStatus: { $in: ["none", "pending"] },
      startedAt: { $gte: twoHoursAgo },
    }).sort({ startedAt: -1 });
    if (byCaller) return byCaller;
  }
  return null;
}

function extensionForContentType(contentType: string): string {
  if (/wav/i.test(contentType)) return "wav";
  if (/ogg/i.test(contentType)) return "ogg";
  return "mp3";
}

function looksLikeUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function findRecordingUrl(body: Record<string, any>): string {
  const direct = pickString(body, [
    "RecordingUrl",
    "recording_url",
    "recording_url_mp3",
    "RecordingUrlMp3",
    "file",
    "FileUrl",
    "url",
  ]);
  if (looksLikeUrl(direct)) return direct;
  return "";
}

/**
 * Downloads the recording bytes. Tries a direct URL from the callback first,
 * then falls back to the Recordings API resource for the given recording id.
 */
async function downloadRecording(
  body: Record<string, any>
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { authId, authToken, apiBaseUrl } = getVobizConfig();
  const authHeaders = { "X-Auth-ID": authId, "X-Auth-Token": authToken };

  const candidates: string[] = [];
  const directUrl = findRecordingUrl(body);
  if (directUrl) candidates.push(directUrl);

  const recordingId = pickString(body, ["RecordingID", "recording_id", "RecordingId", "recording_uuid"]);
  if (recordingId) {
    candidates.push(`${apiBaseUrl}/Account/${authId}/Recording/${recordingId}`);
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (/^audio\//i.test(contentType) || /octet-stream/i.test(contentType)) {
        return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
      }
      // Metadata JSON: extract a nested recording URL and fetch it.
      const meta = (await response.json()) as Record<string, any>;
      const metaUrl = findRecordingUrl(meta);
      if (metaUrl) {
        const fileResponse = await fetch(metaUrl, { headers: authHeaders });
        if (fileResponse.ok) {
          return {
            buffer: Buffer.from(await fileResponse.arrayBuffer()),
            contentType: fileResponse.headers.get("content-type") ?? "audio/mpeg",
          };
        }
      }
    } catch (err) {
      console.error(`Failed to download Vobiz recording from ${url}:`, err);
    }
  }
  return null;
}

async function handleRecordingCompleted(body: Record<string, any>): Promise<void> {
  if (!isVobizConfigured()) {
    console.warn("Vobiz not configured; skipping recording ingestion.");
    return;
  }
  const callSession = await correlateCallSession(body);
  if (!callSession) {
    console.warn("Could not correlate Vobiz recording to a call session.");
    return;
  }

  const callUuid = pickString(body, ["CallUUID", "call_uuid"]);
  if (callUuid && !callSession.vobizCallUuid) {
    callSession.vobizCallUuid = callUuid;
  }

  const download = await downloadRecording(body);
  if (!download) {
    callSession.recordingStatus = "failed";
    await callSession.save();
    return;
  }

  const ext = extensionForContentType(download.contentType);
  const contentType = download.contentType.startsWith("audio/")
    ? download.contentType
    : ext === "wav"
      ? "audio/wav"
      : "audio/mpeg";
  const key = createUploadKey({
    scope: "support",
    organizationId: String(callSession.organizationId),
    fileName: `call-${callSession.openaiCallId}.${ext}`,
    contentType,
    size: download.buffer.length,
    prefixParts: ["calls"],
  });

  await putObjectBuffer({ key, body: download.buffer, contentType });

  callSession.recordingStatus = "stored";
  callSession.recordingKey = key;
  callSession.recordingUrl = fileUrlForKey(key);
  await callSession.save();

  if (callSession.ticketId) {
    const message = await TicketMessage.create({
      ticketId: callSession.ticketId,
      organizationId: callSession.organizationId,
      authorType: "system",
      bodyText: "Call recording",
      attachments: [
        {
          key,
          originalName: `call-recording.${ext}`,
          contentType,
          size: download.buffer.length,
          url: null,
        },
      ],
    });
    try {
      await broadcastMessageCreated(message);
      const ticket = await Ticket.findById(callSession.ticketId).populate("customerId").lean();
      if (ticket) {
        broadcastTicketUpdate(String(callSession.organizationId), serializeTicket(ticket));
      }
    } catch (err) {
      console.error("Failed to broadcast call recording message:", err);
    }
  }
}

async function handleHangup(body: Record<string, any>): Promise<void> {
  const callUuid = pickString(body, ["CallUUID", "call_uuid"]);
  if (!callUuid) return;
  const callSession = await correlateCallSession(body);
  if (callSession && !callSession.vobizCallUuid) {
    callSession.vobizCallUuid = callUuid;
    await callSession.save();
  }
}

/**
 * Entry point for Vobiz callbacks (recording.completed, Hangup, etc). Signature
 * is verified before any side effects.
 */
export async function ingestVobizCallback(input: VobizCallbackInput): Promise<void> {
  if (!verifyVobizSignature(input)) {
    console.error("Rejected Vobiz callback: invalid signature.");
    return;
  }
  const body = parseBody(input.rawBody);
  const event = pickString(body, ["Event", "event", "EventType", "event_type"]).toLowerCase();

  if (event.includes("recording")) {
    await handleRecordingCompleted(body);
    return;
  }
  if (event === "hangup") {
    await handleHangup(body);
  }
}
