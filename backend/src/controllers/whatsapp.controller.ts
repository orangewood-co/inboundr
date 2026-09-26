import type { Request, Response } from "express";

import { getWhatsAppPlatformConfig } from "../config/whatsapp.config";
import { WhatsAppAccount } from "../models/whatsapp-account.model";
import {
  findWhatsAppAccountByPhoneNumberId,
  processWhatsAppMessagesValue,
  type WebhookMessagesValue,
} from "../services/whatsapp-support.service";
import { appSecretFor, verifyWhatsAppSignature } from "../services/whatsapp.service";

function rawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

/**
 * Meta's one-time webhook verification handshake: echo `hub.challenge` when the
 * verify token matches either the platform token or any connected account's
 * token (organizations that bring their own Meta app get a per-account token).
 */
export async function whatsAppWebhookVerify(req: Request, res: Response): Promise<void> {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "").trim();
  const challenge = String(req.query["hub.challenge"] ?? "");

  if (mode !== "subscribe" || !token) {
    res.status(400).send("Bad request");
    return;
  }

  const platformToken = getWhatsAppPlatformConfig().verifyToken;
  const matchesPlatform = Boolean(platformToken && token === platformToken);
  const matchesAccount = !matchesPlatform && Boolean(await WhatsAppAccount.exists({ verifyToken: token }));

  if (!matchesPlatform && !matchesAccount) {
    res.status(403).send("Verification failed");
    return;
  }
  res.status(200).type("text/plain").send(challenge);
}

interface WebhookEntry {
  id?: string;
  changes?: Array<{ field?: string; value?: WebhookMessagesValue }>;
}

/**
 * Inbound events. The body is parsed to find the phone number id so the right
 * app secret can be chosen, but nothing is acted on until the signature checks
 * out against the raw bytes. Always answers 200 quickly; work runs out of band.
 */
export async function whatsAppWebhook(req: Request, res: Response): Promise<void> {
  const payload = rawBody(req);

  let body: { object?: string; entry?: WebhookEntry[] };
  try {
    body = JSON.parse(payload.toString("utf8"));
  } catch {
    res.status(400).send("Invalid payload");
    return;
  }

  if (body?.object !== "whatsapp_business_account") {
    res.status(200).send("ignored");
    return;
  }

  const changes = (body.entry ?? []).flatMap((entry) => entry.changes ?? []);
  const messageChanges = changes.filter((change) => change.field === "messages" && change.value);
  const phoneNumberIds = [
    ...new Set(
      messageChanges
        .map((change) => change.value?.metadata?.phone_number_id ?? "")
        .filter(Boolean)
    ),
  ];

  const skipSignature = process.env.SKIP_SIGNATURE_VALIDATION === "true";
  const signature = req.header("x-hub-signature-256");

  // Resolve accounts first: the secret used for verification depends on them.
  const accounts = await Promise.all(phoneNumberIds.map((id) => findWhatsAppAccountByPhoneNumberId(id)));
  const knownAccounts = accounts.filter(Boolean) as NonNullable<(typeof accounts)[number]>[];

  if (!skipSignature) {
    const secrets = new Set<string>();
    for (const account of knownAccounts) {
      const secret = appSecretFor(account);
      if (secret) secrets.add(secret);
    }
    const platformSecret = getWhatsAppPlatformConfig().appSecret;
    if (platformSecret) secrets.add(platformSecret);

    const verified = [...secrets].some((secret) => verifyWhatsAppSignature(payload, signature, secret));
    if (!verified) {
      console.error(
        `Invalid WhatsApp webhook signature (phone_number_ids: ${phoneNumberIds.join(", ") || "none"})`
      );
      res.status(401).send("Invalid signature");
      return;
    }
  }

  res.status(200).send("ok");

  if (knownAccounts.length === 0) {
    if (phoneNumberIds.length > 0) {
      console.warn(`WhatsApp webhook for unknown phone_number_id(s): ${phoneNumberIds.join(", ")}`);
    }
    return;
  }

  const accountByPhoneNumberId = new Map(knownAccounts.map((account) => [account.phoneNumberId, account]));
  void (async () => {
    for (const change of messageChanges) {
      const value = change.value!;
      const account = accountByPhoneNumberId.get(value.metadata?.phone_number_id ?? "");
      if (!account) continue;
      try {
        await processWhatsAppMessagesValue(account, value);
      } catch (err) {
        console.error(`Failed to process WhatsApp webhook change for ${account.phoneNumberId}:`, err);
      }
    }
  })();
}
