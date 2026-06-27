import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import mongoose from "mongoose";

import { getOpenAiClient } from "../lib/openai-realtime";
import { CallSession } from "../models/call-session.model";
import { Organization } from "../models/organization.model";
import { OrgPhoneNumber } from "../models/org-phone-number.model";
import { hasEffectiveFeature } from "../services/entitlement.service";
import { acceptAndMonitorCall } from "../services/voice-agent.service";

function rawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

// TEMP DEBUG: append telephony events to a file for diagnosis.
const DEBUG_LOG = path.join(process.cwd(), "telephony-debug.log");
function debugLog(label: string, payload: unknown): void {
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${new Date().toISOString()} ${label} ${JSON.stringify(payload)}\n`
    );
  } catch {
    // ignore
  }
}

/** Extracts the user portion of a SIP/TEL URI as an E.164-style number. */
export function parseSipNumber(value: string): string {
  if (!value) return "";
  const match = value.match(/(?:sips?|tel):\s*<?\+?([0-9][0-9\-.\s()]*)@?/i);
  const digits = (match?.[1] ?? "").replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

function sipHeaderValue(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  const entry = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
  return entry?.value ?? "";
}

function digitsOf(value: string): string {
  return (value || "").replace(/[^0-9]/g, "");
}

/**
 * Parses a caller number from a SIP From/Remote-Party-ID header, preferring a
 * `+E.164` display name (e.g. `"+917870218634" <sip:07870218634@host>`) which
 * carriers often include with the full country code, over the URI user part
 * (which may be a national format like `07870218634`).
 */
function parseCallerNumber(headerValue: string): string {
  const display = headerValue.match(/\+(\d{8,15})/);
  if (display) return `+${display[1]}`;
  return parseSipNumber(headerValue);
}

/**
 * Determines the dialed (DID) number from the INVITE. With OpenAI SIP the `To`
 * header user-part is the OpenAI project id (e.g. `proj_...@sip.api.openai.com`),
 * not the called number, so we also probe headers carriers use to carry the
 * original DID. Returns "" when no dialed number is present in the INVITE.
 */
function parseDialedNumber(headers: Array<{ name: string; value: string }>): string {
  for (const name of [
    "To",
    "Diversion",
    "P-Called-Party-ID",
    "X-Called-Number",
    "X-DID",
    "X-Original-To",
  ]) {
    const parsed = parseSipNumber(sipHeaderValue(headers, name));
    if (parsed) return parsed;
  }
  return "";
}

/**
 * Resolves the inbound call to an active org phone-number mapping. Prefers the
 * dialed number when the carrier passes one; otherwise (OpenAI SIP routes by
 * project id, so the DID is frequently absent from the INVITE) falls back to the
 * single active number when the account only has one. Multi-number accounts must
 * have the carrier forward the DID for correct routing.
 */
async function resolveOrgMapping(
  dialedNumber: string
): Promise<{ mapping: any; via: string } | null> {
  if (dialedNumber) {
    const mapping = await findActiveOrgPhoneNumber(dialedNumber);
    if (mapping) return { mapping, via: "dialed-number" };
  }

  const active = await OrgPhoneNumber.find({ status: "active" }).limit(2).lean();
  if (active.length === 1) return { mapping: active[0], via: "single-active-fallback" };

  return null;
}

/**
 * Resolves the dialed number to an active org mapping. Carriers deliver the SIP
 * `To` number in inconsistent formats (e.g. national "08071578922" or
 * "918071578922" vs the stored E.164 "+918071578922"), so after an exact match
 * we fall back to matching on the national significant number (trailing digits).
 */
async function findActiveOrgPhoneNumber(toNumber: string) {
  const exact = await OrgPhoneNumber.findOne({ phoneNumber: toNumber, status: "active" }).lean();
  if (exact) return exact;

  // Drop any leading trunk "0" then take the last 10 digits as the NSN.
  const nsn = digitsOf(toNumber).replace(/^0+/, "").slice(-10);
  if (nsn.length < 7) return null;

  const candidates = await OrgPhoneNumber.find({
    status: "active",
    phoneNumber: { $regex: `${nsn}$` },
  }).lean();
  if (candidates.length === 1) return candidates[0];
  return (
    candidates.find(
      (candidate) => digitsOf(candidate.phoneNumber).replace(/^0+/, "").slice(-10) === nsn
    ) ?? null
  );
}

async function rejectQuietly(callId: string, statusCode = 603): Promise<void> {
  try {
    await getOpenAiClient().realtime.calls.reject(callId, { status_code: statusCode });
  } catch (err) {
    console.error(`Failed to reject call ${callId}:`, err);
  }
}

async function processIncomingCall(data: {
  call_id: string;
  sip_headers: Array<{ name: string; value: string }>;
}): Promise<void> {
  const callId = data.call_id;
  const dialedNumber = parseDialedNumber(data.sip_headers);
  const fromNumber = parseCallerNumber(sipHeaderValue(data.sip_headers, "From"));
  const sipCallId = sipHeaderValue(data.sip_headers, "Call-ID") || null;

  debugLog("incoming", {
    callId,
    dialedNumber,
    fromNumber,
    sipHeaders: data.sip_headers,
  });

  // Idempotency: OpenAI retries webhooks; only handle a call_id once.
  const existing = await CallSession.findOne({ openaiCallId: callId }).select("_id").lean();
  if (existing) return;

  const resolved = await resolveOrgMapping(dialedNumber);
  if (!resolved) {
    debugLog("reject", { callId, reason: "no mapping", dialedNumber, code: 404 });
    console.warn(
      `No active org phone number mapping for dialed "${dialedNumber}" (To: "${sipHeaderValue(
        data.sip_headers,
        "To"
      )}"); rejecting call ${callId}`
    );
    await rejectQuietly(callId, 404);
    return;
  }
  const mapping = resolved.mapping;
  const toNumber = mapping.phoneNumber;
  debugLog("mapping", {
    callId,
    dialedNumber,
    via: resolved.via,
    phoneNumber: mapping.phoneNumber,
    organizationId: String(mapping.organizationId),
  });

  const organization = await Organization.findOne({
    _id: mapping.organizationId,
    status: "active",
  })
    .select("name preferences.supportCall planSlug enabledFeatures disabledFeatures")
    .lean();

  const supportCall = organization?.preferences?.supportCall;
  const callAllowed =
    organization &&
    hasEffectiveFeature(organization, "support") &&
    supportCall?.enabled !== false;

  if (!callAllowed) {
    debugLog("reject", {
      callId,
      reason: "not allowed",
      code: 603,
      orgFound: Boolean(organization),
      supportFeature: organization ? hasEffectiveFeature(organization, "support") : false,
      supportCallEnabled: supportCall?.enabled,
    });
    console.warn(`Voice support not available for org ${mapping.organizationId}; rejecting ${callId}`);
    await rejectQuietly(callId, 603);
    return;
  }
  debugLog("accepting", { callId, voice: supportCall?.voice || "marin" });

  const callSession = await CallSession.create({
    organizationId: mapping.organizationId,
    phoneNumber: toNumber,
    callerNumber: fromNumber,
    openaiCallId: callId,
    sipCallId,
    status: "incoming",
    startedAt: new Date(),
  });

  try {
    await acceptAndMonitorCall({
      callId,
      callSessionId: callSession._id as mongoose.Types.ObjectId,
      organizationId: mapping.organizationId as mongoose.Types.ObjectId,
      organizationName: organization!.name,
      callerNumber: fromNumber,
      voice: supportCall?.voice || "marin",
      greeting: supportCall?.greeting || "",
      instructionsOverride: supportCall?.instructions || "",
    });
    debugLog("accepted", { callId });
  } catch (err) {
    debugLog("accept_failed", { callId, error: String((err as Error)?.message ?? err) });
    console.error(`Failed to accept call ${callId}:`, err);
    await CallSession.updateOne(
      { _id: callSession._id },
      { status: "failed", error: String((err as Error)?.message ?? err) }
    );
    await rejectQuietly(callId, 500);
  }
}

export async function openaiCallWebhook(req: Request, res: Response): Promise<void> {
  const payload = rawBody(req);
  let event: any;

  if (process.env.SKIP_SIGNATURE_VALIDATION === "true") {
    try {
      event = JSON.parse(payload);
    } catch {
      res.status(400).send("Invalid payload");
      return;
    }
  } else {
    try {
      event = await getOpenAiClient().webhooks.unwrap(payload, req.headers as any);
    } catch (err) {
      console.error("Invalid OpenAI webhook signature:", err);
      res.status(400).send("Invalid signature");
      return;
    }
  }

  debugLog("webhook", { type: event?.type });

  // Acknowledge fast; processing (accept + WS) happens out of band.
  res.status(200).send("ok");

  if (event?.type === "realtime.call.incoming") {
    void processIncomingCall(event.data).catch((err) => {
      console.error("Failed to process incoming call:", err);
    });
  }
}
