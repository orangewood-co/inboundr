import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Call } from "../models/call.model";
import { PhoneNumber } from "../models/phone-number.model";
import { VoiceAgentConfig } from "../models/voice-agent-config.model";
import { createPresignedViewUrl } from "../services/storage.service";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function serializeCall(call: any, includeTranscript = false) {
  return {
    _id: call._id,
    callerNumber: call.callerNumber,
    dialedNumber: call.dialedNumber,
    status: call.status,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    summary: call.summary,
    extraction: call.extraction,
    hasRecording: Boolean(call.recordingKey),
    customerId: call.customerId,
    createdAt: call.createdAt,
    ...(includeTranscript ? { transcript: call.transcript } : {}),
  };
}

export async function listCalls(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));

    const [calls, total] = await Promise.all([
      Call.find({ organizationId: organization._id })
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-transcript")
        .lean(),
      Call.countDocuments({ organizationId: organization._id }),
    ]);

    res.json({
      calls: calls.map((call) => serializeCall(call)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("Error listing calls:", err);
    res.status(500).json({ error: "Failed to list calls" });
  }
}

export async function getCall(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = stringValue(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid call id" });
      return;
    }

    const call = await Call.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    res.json({ call: serializeCall(call, true) });
  } catch (err) {
    console.error("Error fetching call:", err);
    res.status(500).json({ error: "Failed to fetch call" });
  }
}

export async function getCallRecordingUrl(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = stringValue(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid call id" });
      return;
    }

    const call = await Call.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!call.recordingKey) {
      res.status(404).json({ error: "This call has no recording" });
      return;
    }

    const { url, expiresInSeconds } = await createPresignedViewUrl(call.recordingKey);
    res.json({ url, expiresInSeconds });
  } catch (err) {
    console.error("Error creating recording URL:", err);
    res.status(500).json({ error: "Failed to create recording URL" });
  }
}

export async function getVoiceAgentSettings(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const [config, numbers] = await Promise.all([
      VoiceAgentConfig.findOne({ organizationId: organization._id }).lean(),
      PhoneNumber.find({ organizationId: organization._id, active: true }).lean(),
    ]);

    res.json({
      config: {
        enabled: config?.enabled ?? true,
        businessName: config?.businessName ?? "",
        greeting: config?.greeting ?? "",
        businessInfo: config?.businessInfo ?? "",
        extraInstructions: config?.extraInstructions ?? "",
      },
      phoneNumbers: numbers.map((number) => ({
        _id: number._id,
        number: number.number,
        label: number.label,
      })),
    });
  } catch (err) {
    console.error("Error fetching voice agent settings:", err);
    res.status(500).json({ error: "Failed to fetch voice agent settings" });
  }
}

export async function updateVoiceAgentSettings(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const update = {
      enabled: req.body?.enabled === undefined ? true : Boolean(req.body.enabled),
      businessName: stringValue(req.body?.businessName).slice(0, 200),
      greeting: stringValue(req.body?.greeting).slice(0, 500),
      businessInfo: String(req.body?.businessInfo ?? "").slice(0, 8000),
      extraInstructions: String(req.body?.extraInstructions ?? "").slice(0, 4000),
    };

    const config = await VoiceAgentConfig.findOneAndUpdate(
      { organizationId: organization._id },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    res.json({
      config: {
        enabled: config?.enabled ?? true,
        businessName: config?.businessName ?? "",
        greeting: config?.greeting ?? "",
        businessInfo: config?.businessInfo ?? "",
        extraInstructions: config?.extraInstructions ?? "",
      },
    });
  } catch (err) {
    console.error("Error updating voice agent settings:", err);
    res.status(500).json({ error: "Failed to update voice agent settings" });
  }
}
