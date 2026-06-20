import type { Request, Response } from "express";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Organization } from "../models/organization.model";

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
