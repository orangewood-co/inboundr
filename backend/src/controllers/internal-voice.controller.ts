import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Call } from "../models/call.model";
import { Organization } from "../models/organization.model";
import { PhoneNumber } from "../models/phone-number.model";
import { VoiceAgentConfig } from "../models/voice-agent-config.model";
import { hasEffectiveFeature } from "../services/entitlement.service";
import { searchProductRecords } from "../services/product.service";
import { processCompletedCall } from "../services/voice-call.service";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

/** GET /api/v1/internal/voice/config?number=+91... — resolve dialed number → org + agent config. */
export async function getVoiceConfigByNumber(req: Request, res: Response): Promise<void> {
  try {
    const number = stringValue(req.query.number);
    if (!number) {
      res.status(400).json({ error: "number query parameter is required" });
      return;
    }

    const phoneNumber = await PhoneNumber.findOne({ number, active: true }).lean();
    if (!phoneNumber) {
      res.status(404).json({ error: "Phone number is not assigned" });
      return;
    }

    const organization = await Organization.findById(phoneNumber.organizationId).lean();
    if (!organization || organization.status === "suspended") {
      res.status(404).json({ error: "Organization is not available" });
      return;
    }

    if (!hasEffectiveFeature(organization, "calls")) {
      res.status(404).json({ error: "Calls feature is not enabled for this organization" });
      return;
    }

    const config = await VoiceAgentConfig.findOne({
      organizationId: phoneNumber.organizationId,
    }).lean();

    res.json({
      organizationId: String(phoneNumber.organizationId),
      organizationName: organization.name,
      config: {
        enabled: config?.enabled ?? true,
        businessName: config?.businessName ?? "",
        greeting: config?.greeting ?? "",
        businessInfo: config?.businessInfo ?? "",
        extraInstructions: config?.extraInstructions ?? "",
      },
    });
  } catch (err) {
    console.error("Error resolving voice config:", err);
    res.status(500).json({ error: "Failed to resolve voice config" });
  }
}

/** POST /api/v1/internal/voice/calls — create a call record when a call starts. */
export async function createVoiceCall(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.body?.organizationId);
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }

    const call = await Call.create({
      organizationId,
      callerNumber: stringValue(req.body?.callerNumber),
      dialedNumber: stringValue(req.body?.dialedNumber),
      roomName: stringValue(req.body?.roomName),
      recordingKey: stringValue(req.body?.recordingKey),
      status: "in_progress",
      startedAt: new Date(),
    });

    res.status(201).json({ callId: String(call._id) });
  } catch (err) {
    console.error("Error creating voice call record:", err);
    res.status(500).json({ error: "Failed to create call record" });
  }
}

/** PATCH /api/v1/internal/voice/calls/:id — finalize a call with its transcript. */
export async function finalizeVoiceCall(req: Request, res: Response): Promise<void> {
  try {
    const id = stringValue(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid call id" });
      return;
    }

    const call = await Call.findById(id);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    const transcript = Array.isArray(req.body?.transcript)
      ? req.body.transcript
          .filter(
            (entry: any) =>
              (entry?.role === "user" || entry?.role === "assistant") &&
              typeof entry?.text === "string" &&
              entry.text.trim()
          )
          .map((entry: any) => ({
            role: entry.role,
            text: String(entry.text),
            at: entry.at ? new Date(entry.at) : new Date(),
          }))
      : [];

    const endedAt = new Date();
    call.transcript = transcript;
    call.status = req.body?.status === "failed" ? "failed" : "completed";
    call.endedAt = endedAt;
    call.durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000)
    );
    const recordingKey = stringValue(req.body?.recordingKey);
    if (recordingKey) call.recordingKey = recordingKey;
    await call.save();

    res.json({ ok: true });

    // Summary + lead extraction run after the response; the worker doesn't need to wait.
    processCompletedCall(id).catch((err) => {
      console.error("Post-call processing failed:", err);
    });
  } catch (err) {
    console.error("Error finalizing voice call:", err);
    res.status(500).json({ error: "Failed to finalize call" });
  }
}

/** POST /api/v1/internal/voice/product-search — org-scoped catalog search for the agent tool. */
export async function voiceProductSearch(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.body?.organizationId);
    const query = stringValue(req.body?.query);
    const limit = Math.min(10, Math.max(1, Number(req.body?.limit) || 5));

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }
    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const result = await searchProductRecords({ organizationId, query, limit });

    res.json({
      status: result.status,
      matches: result.matches.map((match) => ({
        brand: match.brand,
        description: match.description,
        code: match.code,
        price: match.price,
      })),
    });
  } catch (err) {
    console.error("Voice product search failed:", err);
    res.status(500).json({ error: "Product search failed" });
  }
}
