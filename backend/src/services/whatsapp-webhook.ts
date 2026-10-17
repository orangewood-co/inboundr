/**
 * Webhook payload shapes (subset of Meta's `messages` field) and helpers that
 * turn an inbound message into readable text and storable media. Shared by
 * every consumer of inbound WhatsApp messages (support tickets, RFQ inbox).
 */

export interface WebhookMedia {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}

export interface WebhookMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WebhookMedia;
  video?: WebhookMedia;
  audio?: WebhookMedia;
  document?: WebhookMedia;
  sticker?: WebhookMedia;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string }; phones?: Array<{ phone?: string }> }>;
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  reaction?: { message_id?: string; emoji?: string };
  errors?: Array<{ code?: number; title?: string; message?: string }>;
  context?: { from?: string; id?: string };
}

export interface WebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted" | string;
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
}

export interface WebhookMessagesValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

export function mediaOf(message: WebhookMessage): WebhookMedia | null {
  return message.image ?? message.video ?? message.audio ?? message.document ?? message.sticker ?? null;
}

function extensionForMime(mime: string): string {
  const base = mime.toLowerCase().split(";")[0]!.trim();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/amr": "amr",
    "application/pdf": "pdf",
  };
  return map[base] ?? "bin";
}

export function fallbackFilename(message: WebhookMessage, mime: string): string {
  const stamp = new Date(Number(message.timestamp) * 1000 || Date.now())
    .toISOString()
    .replace(/[:.]/g, "-");
  const label =
    message.type === "audio" && message.audio?.voice
      ? "voice-note"
      : message.type === "sticker"
        ? "sticker"
        : message.type;
  return `whatsapp-${label}-${stamp}.${extensionForMime(mime)}`;
}

/** Turns a non-text message into something a person can read. */
export function textForMessage(message: WebhookMessage): string {
  switch (message.type) {
    case "text":
      return message.text?.body ?? "";
    case "image":
    case "video":
    case "document":
      return mediaOf(message)?.caption ?? "";
    case "audio":
    case "sticker":
      return "";
    case "location": {
      const loc = message.location;
      if (!loc) return "";
      const label = [loc.name, loc.address].filter(Boolean).join(", ");
      const coords = `${loc.latitude},${loc.longitude}`;
      return `📍 ${label ? `${label} — ` : ""}https://maps.google.com/?q=${coords}`;
    }
    case "contacts": {
      const cards = (message.contacts ?? []).map((card) => {
        const name = card.name?.formatted_name ?? "Contact";
        const phones = (card.phones ?? []).map((phone) => phone.phone).filter(Boolean).join(", ");
        return phones ? `${name}: ${phones}` : name;
      });
      return cards.length ? `Shared contact${cards.length > 1 ? "s" : ""}: ${cards.join("; ")}` : "";
    }
    case "button":
      return message.button?.text ?? message.button?.payload ?? "";
    case "interactive": {
      const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
      return reply?.title ?? "";
    }
    case "reaction":
      return message.reaction?.emoji ? `Reacted ${message.reaction.emoji}` : "";
    case "unsupported":
      return "[Message type not supported by WhatsApp Business API]";
    default:
      return `[${message.type} message]`;
  }
}

export type WhatsAppDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export function deliveryStatusFromWebhook(status: string): WhatsAppDeliveryStatus | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

/** Statuses can arrive out of order (read before delivered); never regress. */
export function shouldApplyDeliveryStatus(
  current: WhatsAppDeliveryStatus | null | undefined,
  next: WhatsAppDeliveryStatus
): boolean {
  if (next === "failed") return true;
  const currentRank = current ? DELIVERY_STATUS_RANK[current] : -1;
  return DELIVERY_STATUS_RANK[next] > currentRank;
}

const DELIVERY_STATUS_RANK: Record<WhatsAppDeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

export function deliveryErrorFromWebhook(status: WebhookStatus): string {
  const error = status.errors?.[0];
  return (error?.error_data?.details || error?.message || error?.title || "Delivery failed").slice(0, 1000);
}

/** Webhook timestamps are epoch seconds as strings. */
export function webhookTimestamp(value: string, fallback = new Date()): Date {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : fallback;
}
