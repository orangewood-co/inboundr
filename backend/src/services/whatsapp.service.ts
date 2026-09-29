import crypto from "node:crypto";

import { decryptSecret } from "../lib/crypto";
import {
  WHATSAPP_MEDIA_MAX_BYTES,
  WHATSAPP_TEXT_MAX_LENGTH,
  getWhatsAppPlatformConfig,
  whatsAppGraphBaseUrl,
} from "../config/whatsapp.config";
import type { IWhatsAppAccount } from "../models/whatsapp-account.model";

/**
 * Thin client for the WhatsApp Business Cloud API (Graph API). Everything is
 * scoped to a connected account so the token and phone number id travel
 * together.
 */

export type WhatsAppMediaKind = "image" | "video" | "audio" | "document" | "sticker";

export interface WhatsAppSendResult {
  /** Provider message id (`wamid.…`). */
  messageId: string;
}

export class WhatsAppApiError extends Error {
  status: number;
  code: number | null;
  subcode: number | null;
  details: string;

  constructor(input: {
    message: string;
    status: number;
    code?: number | null;
    subcode?: number | null;
    details?: string;
  }) {
    super(input.message);
    this.name = "WhatsAppApiError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.subcode = input.subcode ?? null;
    this.details = input.details ?? "";
  }

  /**
   * Meta error 131047: message sent outside the 24h customer-service window
   * (only approved templates are allowed).
   */
  get isOutsideServiceWindow(): boolean {
    return this.code === 131047;
  }

  /** Meta error 190: token expired/invalid; 10/200: permission problems. */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 10 || this.status === 401;
  }

  /** Human-readable message suitable for surfacing to an agent. */
  get agentMessage(): string {
    if (this.isOutsideServiceWindow) {
      return "WhatsApp only allows free-form replies within 24 hours of the customer's last message. Wait for the customer to write again or use an approved template.";
    }
    if (this.code === 131026) {
      return "This number cannot receive WhatsApp messages (not on WhatsApp or has blocked the business).";
    }
    if (this.code === 131049 || this.code === 130429) {
      return "Meta is rate limiting messages to this customer. Try again later.";
    }
    if (this.isAuthError) {
      return "The WhatsApp access token is invalid or expired. Reconnect WhatsApp in Settings → Integrations.";
    }
    return this.details || this.message || "WhatsApp rejected the message.";
  }
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/3gpp"]);
const AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/ogg; codecs=opus",
]);
/**
 * Maps a MIME type to the WhatsApp media message type that can carry it. Types
 * Meta will not render natively (webm audio, csv, xlsx…) fall back to
 * `document`, which accepts any MIME type.
 */
export function whatsAppMediaKindForContentType(contentType: string): WhatsAppMediaKind {
  const normalized = contentType.toLowerCase().split(";")[0]!.trim();
  if (IMAGE_TYPES.has(normalized)) return "image";
  if (VIDEO_TYPES.has(normalized)) return "video";
  if (AUDIO_TYPES.has(normalized) || AUDIO_TYPES.has(contentType.toLowerCase())) return "audio";
  return "document";
}

function accessTokenFor(account: Pick<IWhatsAppAccount, "accessToken">): string {
  return decryptSecret(account.accessToken);
}

export function appSecretFor(account: Pick<IWhatsAppAccount, "appSecret"> | null): string | null {
  if (account?.appSecret) {
    try {
      return decryptSecret(account.appSecret);
    } catch {
      return null;
    }
  }
  return getWhatsAppPlatformConfig().appSecret;
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header (`sha256=<hex hmac>`) over the
 * exact raw request bytes.
 */
export function verifyWhatsAppSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  const header = String(signatureHeader ?? "").trim();
  if (!header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
}

async function graphRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${whatsAppGraphBaseUrl()}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const error = json?.error ?? {};
    throw new WhatsAppApiError({
      message: error.message || `WhatsApp API request failed (${response.status})`,
      status: response.status,
      code: typeof error.code === "number" ? error.code : null,
      subcode: typeof error.error_subcode === "number" ? error.error_subcode : null,
      details: error.error_data?.details || error.error_user_msg || "",
    });
  }
  return json as T;
}

/** Recipient in the format Meta expects: digits only, no leading `+`. */
export function toWhatsAppRecipient(phoneNumber: string): string {
  return String(phoneNumber ?? "").replace(/[^0-9]/g, "");
}

/** Normalizes a Meta `wa_id`/digits string into a `+E.164`-style value for storage. */
export function toE164(digits: string): string {
  const clean = String(digits ?? "").replace(/[^0-9]/g, "");
  return clean ? `+${clean}` : "";
}

async function sendMessagePayload(
  account: IWhatsAppAccount,
  payload: Record<string, unknown>
): Promise<WhatsAppSendResult> {
  const result = await graphRequest<{ messages?: Array<{ id: string }> }>(
    accessTokenFor(account),
    `${account.phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    }
  );
  const messageId = result.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppApiError({ message: "WhatsApp did not return a message id", status: 502 });
  return { messageId };
}

export async function sendWhatsAppText(
  account: IWhatsAppAccount,
  to: string,
  body: string
): Promise<WhatsAppSendResult> {
  return sendMessagePayload(account, {
    to: toWhatsAppRecipient(to),
    type: "text",
    text: { preview_url: true, body: body.slice(0, WHATSAPP_TEXT_MAX_LENGTH) },
  });
}

/**
 * Sends a media message by link. Meta fetches the URL server-side, so a
 * short-lived presigned S3 URL is fine.
 */
export async function sendWhatsAppMediaLink(
  account: IWhatsAppAccount,
  to: string,
  input: { kind: WhatsAppMediaKind; url: string; caption?: string; filename?: string }
): Promise<WhatsAppSendResult> {
  const media: Record<string, unknown> = { link: input.url };
  if (input.caption && input.kind !== "audio" && input.kind !== "sticker") {
    media.caption = input.caption.slice(0, 1024);
  }
  if (input.kind === "document" && input.filename) media.filename = input.filename.slice(0, 240);
  return sendMessagePayload(account, {
    to: toWhatsAppRecipient(to),
    type: input.kind,
    [input.kind]: media,
  });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type WhatsAppTemplateParameter =
  | { type: "text"; text: string }
  | { type: "document"; document: { link: string; filename?: string } }
  | { type: "image"; image: { link: string } };

export interface WhatsAppTemplateComponentInput {
  type: "header" | "body" | "button";
  parameters: WhatsAppTemplateParameter[];
  sub_type?: string;
  index?: number;
}

/**
 * Sends an approved template. Templates are the only message type Meta accepts
 * outside the 24h customer-service window, so all business-initiated sends
 * (invoices, reminders) go through here.
 */
export async function sendWhatsAppTemplate(
  account: IWhatsAppAccount,
  to: string,
  input: { name: string; language: string; components: WhatsAppTemplateComponentInput[] }
): Promise<WhatsAppSendResult> {
  return sendMessagePayload(account, {
    to: toWhatsAppRecipient(to),
    type: "template",
    template: {
      name: input.name,
      language: { code: input.language },
      components: input.components,
    },
  });
}

export interface WhatsAppRemoteTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  rejectedReason: string | null;
}

/** Lists templates on a WABA, paging through Meta's cursor. */
export async function listWhatsAppTemplates(
  account: Pick<IWhatsAppAccount, "accessToken"> & { wabaId: string }
): Promise<WhatsAppRemoteTemplate[]> {
  const token = accessTokenFor(account);
  const templates: WhatsAppRemoteTemplate[] = [];
  let path: string | null =
    `${account.wabaId}/message_templates?fields=id,name,language,status,category,rejected_reason&limit=100`;

  while (path) {
    const page: {
      data?: Array<{
        id: string;
        name: string;
        language: string;
        status: string;
        category: string;
        rejected_reason?: string;
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
    } = await graphRequest(token, path);
    for (const item of page.data ?? []) {
      templates.push({
        id: item.id,
        name: item.name,
        language: item.language,
        status: item.status,
        category: item.category,
        rejectedReason: item.rejected_reason && item.rejected_reason !== "NONE" ? item.rejected_reason : null,
      });
    }
    const after = page.paging?.cursors?.after;
    path =
      page.paging?.next && after
        ? `${account.wabaId}/message_templates?fields=id,name,language,status,category,rejected_reason&limit=100&after=${encodeURIComponent(after)}`
        : null;
  }
  return templates;
}

export interface WhatsAppTemplateDefinition {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  components: Array<Record<string, unknown>>;
}

export async function createWhatsAppTemplate(
  account: Pick<IWhatsAppAccount, "accessToken"> & { wabaId: string },
  definition: WhatsAppTemplateDefinition
): Promise<{ id: string; status: string; category: string }> {
  return graphRequest(accessTokenFor(account), `${account.wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify(definition),
  });
}

/**
 * Uploads a sample file through Meta's Resumable Upload API and returns the
 * handle (`4:…`) that template media headers require as their example.
 */
export async function uploadWhatsAppTemplateSample(
  account: Pick<IWhatsAppAccount, "accessToken">,
  appId: string,
  file: { name: string; contentType: string; data: Buffer }
): Promise<string> {
  const token = accessTokenFor(account);
  const session = await graphRequest<{ id: string }>(
    token,
    `${appId}/uploads?file_name=${encodeURIComponent(file.name)}&file_length=${file.data.byteLength}&file_type=${encodeURIComponent(file.contentType)}`,
    { method: "POST" }
  );
  if (!session?.id) throw new WhatsAppApiError({ message: "Meta did not open an upload session", status: 502 });

  const response = await fetch(`${whatsAppGraphBaseUrl()}/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: "0",
      "Content-Type": file.contentType,
    },
    body: new Uint8Array(file.data),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok || !json?.h) {
    const error = json?.error ?? {};
    throw new WhatsAppApiError({
      message: error.message || `Template sample upload failed (${response.status})`,
      status: response.status,
      code: typeof error.code === "number" ? error.code : null,
    });
  }
  return String(json.h);
}

/**
 * Marks an inbound message as read (blue ticks). When `typing` is set, Meta
 * also shows a typing indicator to the customer for up to ~25s or until the
 * next message is sent.
 */
export async function markWhatsAppMessageRead(
  account: IWhatsAppAccount,
  messageId: string,
  options: { typing?: boolean } = {}
): Promise<void> {
  await graphRequest(accessTokenFor(account), `${account.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      ...(options.typing ? { typing_indicator: { type: "text" } } : {}),
    }),
  });
}

export interface DownloadedWhatsAppMedia {
  data: Buffer;
  contentType: string;
  size: number;
}

/**
 * Resolves a media id to a temporary URL, then downloads the bytes. Both steps
 * require the bearer token.
 */
export async function downloadWhatsAppMedia(
  account: IWhatsAppAccount,
  mediaId: string
): Promise<DownloadedWhatsAppMedia> {
  const token = accessTokenFor(account);
  const meta = await graphRequest<{ url: string; mime_type?: string; file_size?: number }>(
    token,
    mediaId
  );
  if (typeof meta.file_size === "number" && meta.file_size > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new WhatsAppApiError({ message: "WhatsApp media exceeds the size limit", status: 413 });
  }

  const response = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new WhatsAppApiError({
      message: `Failed to download WhatsApp media (${response.status})`,
      status: response.status,
    });
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new WhatsAppApiError({ message: "WhatsApp media exceeds the size limit", status: 413 });
  }
  return {
    data,
    contentType: meta.mime_type || response.headers.get("content-type") || "application/octet-stream",
    size: data.byteLength,
  };
}

export interface WhatsAppPhoneNumberInfo {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string | null;
}

/**
 * Validates a phone number id + token pair by reading the number's profile.
 * Used when an organization connects its account.
 */
export async function fetchWhatsAppPhoneNumberInfo(
  phoneNumberId: string,
  plainAccessToken: string
): Promise<WhatsAppPhoneNumberInfo> {
  const result = await graphRequest<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  }>(plainAccessToken, `${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`);
  return {
    id: result.id,
    displayPhoneNumber: result.display_phone_number ?? "",
    verifiedName: result.verified_name ?? "",
    qualityRating: result.quality_rating ?? null,
  };
}

/**
 * Subscribes the platform app to the WABA's webhooks. Only meaningful when the
 * token belongs to the platform app; harmless (ignored errors) otherwise.
 */
export async function subscribeWhatsAppWebhooks(
  wabaId: string,
  plainAccessToken: string
): Promise<boolean> {
  try {
    await graphRequest(plainAccessToken, `${wabaId}/subscribed_apps`, { method: "POST" });
    return true;
  } catch (err) {
    console.warn(`WhatsApp webhook subscription for WABA ${wabaId} skipped:`, (err as Error).message);
    return false;
  }
}
