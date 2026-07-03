import crypto from "node:crypto";
import type { Request, Response } from "express";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Organization } from "../models/organization.model";
import { OrgPhoneNumber } from "../models/org-phone-number.model";
import { getEffectiveResolutionReasons } from "../services/support-resolution.service";

const SUPPORTED_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
];

function serializeSupportCallSettings(organization: any) {
  const supportCall = organization?.preferences?.supportCall ?? {};
  return {
    enabled: supportCall.enabled !== false,
    voice: typeof supportCall.voice === "string" && supportCall.voice ? supportCall.voice : "marin",
    greeting: supportCall.greeting ?? "",
    instructions: supportCall.instructions ?? "",
    recordingEnabled: supportCall.recordingEnabled !== false,
    updatedBy: supportCall.updatedBy ?? null,
    updatedAt: supportCall.updatedAt ?? null,
    supportedVoices: SUPPORTED_VOICES,
  };
}

function serializeSupportSettings(organization: any) {
  const supportChat = organization?.preferences?.supportChat ?? {};
  return {
    emailTranscriptEnabled: supportChat.emailTranscriptEnabled !== false,
    updatedBy: supportChat.updatedBy ?? null,
    updatedAt: supportChat.updatedAt ?? null,
  };
}

export async function getSupportSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = await Organization.findById(orgReq.organization._id)
      .select("preferences.supportChat")
      .lean();
    res.json({ settings: serializeSupportSettings(organization ?? orgReq.organization) });
  } catch (err) {
    console.error("Failed to load support chat settings:", err);
    res.status(500).json({ error: "Failed to load chat widget settings" });
  }
}

export async function updateSupportSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const emailTranscriptEnabled = Boolean(req.body?.emailTranscriptEnabled);
    const now = new Date();

    const organization = await Organization.findByIdAndUpdate(
      orgReq.organization._id,
      {
        "preferences.supportChat.emailTranscriptEnabled": emailTranscriptEnabled,
        "preferences.supportChat.updatedBy": orgReq.user.id,
        "preferences.supportChat.updatedAt": now,
      },
      { new: true }
    ).lean();

    res.json({ settings: serializeSupportSettings(organization) });
  } catch (err) {
    console.error("Failed to update support chat settings:", err);
    res.status(500).json({ error: "Failed to update chat widget settings" });
  }
}

const RESOLUTION_REASON_LABEL_MAX_LENGTH = 100;
const MAX_RESOLUTION_REASONS = 50;

export async function getSupportResolutionReasons(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = await Organization.findById(orgReq.organization._id)
      .select("preferences.supportResolutionReasons")
      .lean();
    res.json({ reasons: getEffectiveResolutionReasons(organization ?? orgReq.organization) });
  } catch (err) {
    console.error("Failed to load support resolution reasons:", err);
    res.status(500).json({ error: "Failed to load resolution reasons" });
  }
}

export async function updateSupportResolutionReasons(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const raw = req.body?.reasons;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: "At least one resolution reason is required" });
      return;
    }
    if (raw.length > MAX_RESOLUTION_REASONS) {
      res
        .status(400)
        .json({ error: `A maximum of ${MAX_RESOLUTION_REASONS} resolution reasons is allowed` });
      return;
    }

    const seenLabels = new Set<string>();
    const seenIds = new Set<string>();
    const reasons: { id: string; label: string }[] = [];
    for (const item of raw) {
      const source = (item ?? {}) as Record<string, unknown>;
      const label = String(source.label ?? "")
        .trim()
        .slice(0, RESOLUTION_REASON_LABEL_MAX_LENGTH);
      if (!label) {
        res.status(400).json({ error: "Resolution reason label is required" });
        return;
      }
      const normalizedLabel = label.toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        res.status(400).json({ error: `Duplicate resolution reason: ${label}` });
        return;
      }
      seenLabels.add(normalizedLabel);
      // Preserve incoming ids so renames keep their identity; generate ids for new entries.
      let id = String(source.id ?? "").trim();
      if (!id || seenIds.has(id)) id = crypto.randomUUID();
      seenIds.add(id);
      reasons.push({ id, label });
    }

    const organization = await Organization.findByIdAndUpdate(
      orgReq.organization._id,
      { "preferences.supportResolutionReasons": reasons },
      { new: true }
    )
      .select("preferences.supportResolutionReasons")
      .lean();

    res.json({ reasons: getEffectiveResolutionReasons(organization) });
  } catch (err) {
    console.error("Failed to update support resolution reasons:", err);
    res.status(500).json({ error: "Failed to update resolution reasons" });
  }
}

export async function getSupportCallSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const [organization, phoneNumbers] = await Promise.all([
      Organization.findById(orgReq.organization._id).select("preferences.supportCall").lean(),
      OrgPhoneNumber.find({ organizationId: orgReq.organization._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.json({
      settings: serializeSupportCallSettings(organization ?? orgReq.organization),
      phoneNumbers: phoneNumbers.map((number) => ({
        id: String(number._id),
        phoneNumber: number.phoneNumber,
        label: number.label ?? "",
        status: number.status,
      })),
    });
  } catch (err) {
    console.error("Failed to load support call settings:", err);
    res.status(500).json({ error: "Failed to load voice agent settings" });
  }
}

export async function updateSupportCallSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const now = new Date();

    const voice =
      typeof req.body?.voice === "string" && SUPPORTED_VOICES.includes(req.body.voice)
        ? req.body.voice
        : "marin";

    const update: Record<string, unknown> = {
      "preferences.supportCall.enabled": Boolean(req.body?.enabled),
      "preferences.supportCall.voice": voice,
      "preferences.supportCall.greeting": String(req.body?.greeting ?? "").trim().slice(0, 1000),
      "preferences.supportCall.instructions": String(req.body?.instructions ?? "").trim().slice(0, 8000),
      "preferences.supportCall.recordingEnabled": Boolean(req.body?.recordingEnabled),
      "preferences.supportCall.updatedBy": orgReq.user.id,
      "preferences.supportCall.updatedAt": now,
    };

    const organization = await Organization.findByIdAndUpdate(orgReq.organization._id, update, {
      new: true,
    })
      .select("preferences.supportCall")
      .lean();

    res.json({ settings: serializeSupportCallSettings(organization) });
  } catch (err) {
    console.error("Failed to update support call settings:", err);
    res.status(500).json({ error: "Failed to update voice agent settings" });
  }
}
