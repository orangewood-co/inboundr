import { getVobizConfig, isVobizConfigured } from "../config/telephony.config";
import { CallSession, type ICallSession } from "../models/call-session.model";
import { Organization } from "../models/organization.model";
import { TicketMessage } from "../models/ticket-message.model";
import { Ticket } from "../models/ticket.model";
import { createUploadKey, fileUrlForKey, putObjectBuffer } from "./storage.service";
import { broadcastMessageCreated, broadcastTicketUpdate } from "./support-ws.service";
import { serializeTicket } from "./ticket.service";

/** How far back the reconciler scans for sessions still missing a recording. */
const RECONCILE_LOOKBACK_MS = 2 * 60 * 60 * 1000;
/** After this long with no match, give up and mark the recording failed. */
const GIVE_UP_MS = 60 * 60 * 1000;
const MATCH_WINDOW_BEFORE_MS = 2 * 60 * 1000;
const MATCH_WINDOW_AFTER_MS = 30 * 60 * 1000;

export interface VobizRecording {
  recording_id: string;
  recording_url: string;
  recording_format?: string;
  call_uuid?: string;
  from_number?: string;
  to_number?: string;
  add_time?: string;
  recording_type?: string;
}

function digitsOf(value: string): string {
  return (value || "").replace(/[^0-9]/g, "");
}

/** National significant number: trunk "0" stripped, last 10 digits. */
function last10(value: string): string {
  return digitsOf(value).replace(/^0+/, "").slice(-10);
}

function extensionForContentType(contentType: string): string {
  if (/wav/i.test(contentType)) return "wav";
  if (/ogg/i.test(contentType)) return "ogg";
  return "mp3";
}

/**
 * Lists recordings from the Vobiz Recordings API. Filters by call_uuid or
 * recording_type when provided; otherwise returns the most recent recordings.
 */
export async function listVobizRecordings(
  params: { limit?: number; offset?: number; callUuid?: string; recordingType?: string } = {}
): Promise<VobizRecording[]> {
  const { authId, authToken, apiBaseUrl } = getVobizConfig();
  const url = new URL(`${apiBaseUrl}/Account/${authId}/Recording/`);
  url.searchParams.set("limit", String(params.limit ?? 100));
  url.searchParams.set("offset", String(params.offset ?? 0));
  if (params.callUuid) url.searchParams.set("call_uuid", params.callUuid);
  if (params.recordingType) url.searchParams.set("recording_type", params.recordingType);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      console.error(`Vobiz list recordings failed: ${response.status}`);
      return [];
    }
    const data = (await response.json().catch(() => null)) as { objects?: VobizRecording[] } | null;
    return data?.objects ?? [];
  } catch (err) {
    console.error("Vobiz list recordings request failed:", err);
    return [];
  }
}

/**
 * Downloads the recording bytes. Prefers the direct recording_url, then falls
 * back to the Recordings API resource for the recording id. Auth headers are
 * always sent (the file hosts require them) and redirects are followed.
 */
async function downloadRecording(opts: {
  recordingUrl?: string;
  recordingId?: string;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { authId, authToken, apiBaseUrl } = getVobizConfig();
  const authHeaders = { "X-Auth-ID": authId, "X-Auth-Token": authToken };

  const candidates: string[] = [];
  if (opts.recordingUrl && /^https?:\/\//i.test(opts.recordingUrl)) {
    candidates.push(opts.recordingUrl);
  }
  if (opts.recordingId) {
    candidates.push(`${apiBaseUrl}/Account/${authId}/Recording/${opts.recordingId}`);
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: authHeaders, redirect: "follow" });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (/^audio\//i.test(contentType) || /octet-stream/i.test(contentType)) {
        return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
      }
      // Metadata JSON: extract a nested recording URL and fetch it.
      const meta = (await response.json().catch(() => null)) as Record<string, any> | null;
      const metaUrl = typeof meta?.recording_url === "string" ? meta.recording_url : "";
      if (/^https?:\/\//i.test(metaUrl)) {
        const fileResponse = await fetch(metaUrl, { headers: authHeaders, redirect: "follow" });
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

/**
 * Downloads a recording to S3 and attaches it to the call's ticket. Idempotent:
 * returns early if the session already has a stored recording. Returns true when
 * a recording was stored (or already present), false when the download failed.
 */
export async function storeRecordingForSession(
  session: ICallSession,
  opts: { recordingUrl?: string; recordingId?: string; callUuid?: string }
): Promise<boolean> {
  if (!isVobizConfigured()) return false;
  if (session.recordingStatus === "stored") return true;

  if (opts.callUuid && !session.vobizCallUuid) session.vobizCallUuid = opts.callUuid;

  const download = await downloadRecording(opts);
  if (!download) {
    // Leave the session for a later retry; the caller decides when to give up.
    return false;
  }

  const ext = extensionForContentType(download.contentType);
  const contentType = download.contentType.startsWith("audio/")
    ? download.contentType
    : ext === "wav"
      ? "audio/wav"
      : "audio/mpeg";
  const key = createUploadKey({
    scope: "support",
    organizationId: String(session.organizationId),
    fileName: `call-${session.openaiCallId}.${ext}`,
    contentType,
    size: download.buffer.length,
    prefixParts: ["calls"],
  });

  await putObjectBuffer({ key, body: download.buffer, contentType });

  session.recordingStatus = "stored";
  session.recordingKey = key;
  session.recordingUrl = fileUrlForKey(key);
  if (opts.recordingId) session.vobizRecordingId = opts.recordingId;
  await session.save();

  if (session.ticketId) {
    const message = await TicketMessage.create({
      ticketId: session.ticketId,
      organizationId: session.organizationId,
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
      const ticket = await Ticket.findById(session.ticketId).populate("customerId").lean();
      if (ticket) {
        broadcastTicketUpdate(String(session.organizationId), serializeTicket(ticket));
      }
    } catch (err) {
      console.error("Failed to broadcast call recording message:", err);
    }
  }
  return true;
}

/** Heuristic match: caller/callee numbers (by NSN) plus add_time in the call window. */
function recordingMatchesSession(recording: VobizRecording, session: ICallSession): boolean {
  if (last10(recording.to_number ?? "") !== last10(session.phoneNumber)) return false;
  if (last10(recording.from_number ?? "") !== last10(session.callerNumber)) return false;

  const addTime = recording.add_time ? new Date(recording.add_time).getTime() : NaN;
  if (Number.isNaN(addTime)) return true; // No timestamp: rely on the number match.

  const start = session.startedAt.getTime() - MATCH_WINDOW_BEFORE_MS;
  const end = (session.endedAt?.getTime() ?? session.startedAt.getTime()) + MATCH_WINDOW_AFTER_MS;
  return addTime >= start && addTime <= end;
}

/**
 * Background reconciliation: pulls recordings from Vobiz for recently completed
 * calls that don't yet have one stored, matches them, downloads + attaches, and
 * gives up (marks failed) once a call is older than the give-up threshold.
 */
export async function reconcileCallRecordings(): Promise<void> {
  if (!isVobizConfigured()) return;

  const now = Date.now();
  const sessions = await CallSession.find({
    status: "completed",
    recordingStatus: { $in: ["none", "pending"] },
    endedAt: { $gte: new Date(now - RECONCILE_LOOKBACK_MS) },
  });
  if (sessions.length === 0) return;

  // Fetch the recent recordings list once per run and reuse it across sessions.
  let recentRecordings: VobizRecording[] | null = null;
  const getRecentRecordings = async () => {
    if (recentRecordings === null) recentRecordings = await listVobizRecordings({ limit: 100 });
    return recentRecordings;
  };

  for (const session of sessions) {
    try {
      const org = (await Organization.findById(session.organizationId)
        .select("preferences.supportCall.recordingEnabled")
        .lean()) as any;
      if (org?.preferences?.supportCall?.recordingEnabled === false) {
        session.recordingStatus = "failed";
        await session.save();
        continue;
      }

      let match: VobizRecording | null = null;

      // Fast path: exact correlation when the Vobiz call_uuid is known.
      if (session.vobizCallUuid) {
        const byUuid = await listVobizRecordings({ callUuid: session.vobizCallUuid, limit: 20 });
        match = byUuid[0] ?? null;
      }

      if (!match) {
        const all = await getRecentRecordings();
        const candidates = all.filter((recording) => recordingMatchesSession(recording, session));

        // Exclude recordings already attached to another session.
        const usable: VobizRecording[] = [];
        for (const recording of candidates) {
          const taken = await CallSession.findOne({
            vobizRecordingId: recording.recording_id,
            _id: { $ne: session._id },
          })
            .select("_id")
            .lean();
          if (!taken) usable.push(recording);
        }

        // Prefer the recording whose add_time is closest to the call.
        const reference = (session.endedAt ?? session.startedAt).getTime();
        usable.sort(
          (a, b) =>
            Math.abs(new Date(a.add_time ?? 0).getTime() - reference) -
            Math.abs(new Date(b.add_time ?? 0).getTime() - reference)
        );
        match = usable[0] ?? null;
      }

      if (match) {
        await storeRecordingForSession(session, {
          recordingUrl: match.recording_url,
          recordingId: match.recording_id,
          callUuid: match.call_uuid,
        });
      } else if (session.endedAt && session.endedAt.getTime() < now - GIVE_UP_MS) {
        session.recordingStatus = "failed";
        await session.save();
      }
    } catch (err) {
      console.error(`Failed to reconcile recording for call session ${session._id}:`, err);
    }
  }
}
