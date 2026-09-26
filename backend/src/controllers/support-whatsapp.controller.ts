import crypto from "node:crypto";
import type { Request, Response } from "express";

import { apiOrigin } from "../config/origins.config";
import { getWhatsAppPlatformConfig } from "../config/whatsapp.config";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { WhatsAppAccount, type IWhatsAppAccount } from "../models/whatsapp-account.model";
import {
  WhatsAppApiError,
  fetchWhatsAppPhoneNumberInfo,
  subscribeWhatsAppWebhooks,
} from "../services/whatsapp.service";

function webhookUrl(): string {
  return `${apiOrigin}/api/v1/whatsapp/webhook`;
}

function serializeAccount(account: IWhatsAppAccount | any | null) {
  const platform = getWhatsAppPlatformConfig();
  if (!account) {
    return {
      account: null,
      webhookUrl: webhookUrl(),
      // Before connecting, the org can only use the platform token (if any);
      // a per-account token is generated on connect.
      verifyToken: platform.verifyToken,
      platformAppSecretConfigured: Boolean(platform.appSecret),
    };
  }
  return {
    account: {
      id: String(account._id),
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId ?? null,
      displayPhoneNumber: account.displayPhoneNumber ?? "",
      verifiedName: account.verifiedName ?? "",
      enabled: account.enabled !== false,
      status: account.status,
      errorMessage: account.errorMessage ?? null,
      hasAppSecret: Boolean(account.appSecret),
      lastInboundAt: account.lastInboundAt ?? null,
      lastOutboundAt: account.lastOutboundAt ?? null,
      updatedAt: account.updatedAt ?? null,
    },
    webhookUrl: webhookUrl(),
    verifyToken: account.verifyToken,
    platformAppSecretConfigured: Boolean(platform.appSecret),
  };
}

export async function getSupportWhatsAppSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const account = await WhatsAppAccount.findOne({ organizationId: orgReq.organization._id }).lean();
    res.json(serializeAccount(account));
  } catch (err) {
    console.error("Failed to load WhatsApp settings:", err);
    res.status(500).json({ error: "Failed to load WhatsApp settings" });
  }
}

/**
 * Connects or updates the organization's WhatsApp number. The token is
 * validated against Meta before anything is stored so a typo surfaces
 * immediately rather than on the first customer message.
 */
export async function updateSupportWhatsAppSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const existing = await WhatsAppAccount.findOne({ organizationId: orgReq.organization._id });

    const phoneNumberId = String(req.body?.phoneNumberId ?? existing?.phoneNumberId ?? "").trim();
    const wabaId = req.body?.wabaId !== undefined
      ? String(req.body.wabaId ?? "").trim() || null
      : existing?.wabaId ?? null;
    const newAccessToken = String(req.body?.accessToken ?? "").trim();
    const newAppSecret = req.body?.appSecret !== undefined ? String(req.body.appSecret ?? "").trim() : null;
    const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : existing?.enabled ?? true;

    if (!phoneNumberId || !/^\d{5,32}$/.test(phoneNumberId)) {
      res.status(400).json({ error: "A valid WhatsApp phone number ID is required" });
      return;
    }
    if (!newAccessToken && !existing) {
      res.status(400).json({ error: "An access token is required to connect WhatsApp" });
      return;
    }

    const conflict = await WhatsAppAccount.findOne({
      phoneNumberId,
      organizationId: { $ne: orgReq.organization._id },
    })
      .select("_id")
      .lean();
    if (conflict) {
      res.status(409).json({ error: "This WhatsApp number is already connected to another organization" });
      return;
    }

    const plainToken = newAccessToken || decryptSecret(existing!.accessToken);

    let info;
    try {
      info = await fetchWhatsAppPhoneNumberInfo(phoneNumberId, plainToken);
    } catch (err) {
      const message =
        err instanceof WhatsAppApiError
          ? err.isAuthError
            ? "Meta rejected the access token. Generate a permanent System User token with whatsapp_business_messaging and whatsapp_business_management permissions."
            : err.message
          : "Could not reach the WhatsApp API";
      res.status(400).json({ error: `WhatsApp validation failed: ${message}` });
      return;
    }

    if (wabaId && newAccessToken) {
      await subscribeWhatsAppWebhooks(wabaId, plainToken);
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      phoneNumberId,
      wabaId,
      displayPhoneNumber: info.displayPhoneNumber,
      verifiedName: info.verifiedName,
      enabled,
      status: enabled ? "connected" : "disabled",
      errorMessage: null,
      updatedBy: orgReq.user.id,
    };
    if (newAccessToken) update.accessToken = encryptSecret(newAccessToken);
    if (newAppSecret !== null) update.appSecret = newAppSecret ? encryptSecret(newAppSecret) : null;

    let account: IWhatsAppAccount;
    if (existing) {
      account = (await WhatsAppAccount.findByIdAndUpdate(existing._id, update, {
        returnDocument: "after",
      }))!;
    } else {
      account = await WhatsAppAccount.create({
        ...update,
        organizationId: orgReq.organization._id,
        verifyToken: crypto.randomBytes(18).toString("base64url"),
        createdBy: orgReq.user.id,
        createdAt: now,
      });
    }

    res.json(serializeAccount(account));
  } catch (err) {
    console.error("Failed to update WhatsApp settings:", err);
    res.status(500).json({ error: "Failed to save WhatsApp settings" });
  }
}

export async function disconnectSupportWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    await WhatsAppAccount.deleteOne({ organizationId: orgReq.organization._id });
    res.json(serializeAccount(null));
  } catch (err) {
    console.error("Failed to disconnect WhatsApp:", err);
    res.status(500).json({ error: "Failed to disconnect WhatsApp" });
  }
}
