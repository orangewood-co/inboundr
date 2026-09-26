import mongoose from "mongoose";

import { WHATSAPP_SERVICE_WINDOW_MS } from "../config/whatsapp.config";
import { Customer } from "../models/customer.model";
import { Organization } from "../models/organization.model";
import { OrganizationMember } from "../models/organization-member.model";
import { Ticket, type ITicket } from "../models/ticket.model";
import {
  TicketMessage,
  type ITicketMessage,
  type ITicketMessageAttachment,
  type TicketMessageDeliveryStatus,
} from "../models/ticket-message.model";
import { WhatsAppAccount, type IWhatsAppAccount } from "../models/whatsapp-account.model";
import { hasEffectiveFeature } from "./entitlement.service";
import { createNotificationForRecipient } from "./notification.service";
import { createPresignedViewUrl, createUploadKey, putObjectBuffer } from "./storage.service";
import {
  appendVisitorMessage,
  generateSupportBotMessage,
  SUPPORT_MESSAGE_MAX_LENGTH,
  type SupportMessageAttachmentInput,
} from "./support-chat.service";
import {
  broadcastMessageCreated,
  broadcastMessageUpdated,
  broadcastTicketUpdate,
} from "./support-ws.service";
import { formatTicketReference, serializeTicket } from "./ticket.service";
import {
  WhatsAppApiError,
  downloadWhatsAppMedia,
  markWhatsAppMessageRead,
  sendWhatsAppMediaLink,
  sendWhatsAppText,
  toE164,
  whatsAppMediaKindForContentType,
} from "./whatsapp.service";

/**
 * A resolved/closed WhatsApp ticket is reopened (rather than a new ticket
 * created) when the customer writes again within this window.
 */
const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Webhook payload shapes (subset of Meta's `messages` field)
// ---------------------------------------------------------------------------

interface WebhookMedia {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}

interface WebhookMessage {
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

interface WebhookStatus {
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

// ---------------------------------------------------------------------------
// Account lookup
// ---------------------------------------------------------------------------

export async function findWhatsAppAccountByPhoneNumberId(
  phoneNumberId: string
): Promise<IWhatsAppAccount | null> {
  const id = String(phoneNumberId ?? "").trim();
  if (!id) return null;
  return WhatsAppAccount.findOne({ phoneNumberId: id });
}

export async function findWhatsAppAccountForOrganization(
  organizationId: mongoose.Types.ObjectId | string
): Promise<IWhatsAppAccount | null> {
  return WhatsAppAccount.findOne({ organizationId });
}

async function markAccountError(account: IWhatsAppAccount, message: string): Promise<void> {
  await WhatsAppAccount.updateOne(
    { _id: account._id },
    { status: "error", errorMessage: message.slice(0, 500) }
  );
}

async function markAccountHealthy(
  account: IWhatsAppAccount,
  direction: "inbound" | "outbound"
): Promise<void> {
  const update: Record<string, unknown> = {
    [direction === "inbound" ? "lastInboundAt" : "lastOutboundAt"]: new Date(),
  };
  if (account.status === "error") {
    update.status = "connected";
    update.errorMessage = null;
  }
  await WhatsAppAccount.updateOne({ _id: account._id }, update);
}

// ---------------------------------------------------------------------------
// Service window
// ---------------------------------------------------------------------------

/**
 * Whether a free-form business message can still be sent: Meta requires the
 * customer to have written within the last 24 hours.
 */
export function isWhatsAppServiceWindowOpen(
  ticket: Pick<ITicket, "lastVisitorMessageAt">,
  now = new Date()
): boolean {
  if (!ticket.lastVisitorMessageAt) return false;
  return now.getTime() - new Date(ticket.lastVisitorMessageAt).getTime() < WHATSAPP_SERVICE_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Ticket threading
// ---------------------------------------------------------------------------

function digitsOf(value: string): string {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

/**
 * Matches a customer by phone. `Customer.contactNumber` is free text, so the
 * comparison is on the national significant number (trailing 10 digits),
 * mirroring the voice-support matcher.
 */
async function findCustomerIdByPhone(
  organizationId: mongoose.Types.ObjectId,
  phoneNumber: string
): Promise<mongoose.Types.ObjectId | null> {
  const nsn = digitsOf(phoneNumber).slice(-10);
  if (nsn.length < 7) return null;
  const candidates = await Customer.find({
    organizationId,
    isArchived: { $ne: true },
    contactNumber: { $regex: `${nsn}\\s*$` },
  })
    .select("_id contactNumber")
    .limit(5)
    .lean();
  const exact = candidates.filter((customer) => digitsOf(customer.contactNumber ?? "").slice(-10) === nsn);
  return exact.length === 1 && exact[0] ? exact[0]._id : null;
}

async function nextTicketNumber(organizationId: mongoose.Types.ObjectId): Promise<number> {
  const latest = await Ticket.findOne({ organizationId })
    .sort({ ticketNumber: -1 })
    .select("ticketNumber")
    .lean();
  return (latest?.ticketNumber ?? 0) + 1;
}

/**
 * Finds the conversation a new inbound message belongs to. Open/pending tickets
 * are always continued; recently resolved ones are continued (and reopened by
 * `appendVisitorMessage`); anything older starts a fresh ticket so a customer
 * coming back a week later gets a clean thread.
 */
async function findThreadTicket(
  organizationId: mongoose.Types.ObjectId,
  phoneNumber: string,
  now: Date
): Promise<ITicket | null> {
  const latest = await Ticket.findOne({
    organizationId,
    channel: "whatsapp",
    "requester.phoneNumber": phoneNumber,
    isArchived: { $ne: true },
  }).sort({ lastMessageAt: -1 });
  if (!latest) return null;
  if (latest.status === "open" || latest.status === "pending") return latest;
  const lastCustomerActivity = latest.lastVisitorMessageAt ?? latest.lastMessageAt;
  const since = now.getTime() - new Date(lastCustomerActivity).getTime();
  return since <= REOPEN_WINDOW_MS ? latest : null;
}

async function createWhatsAppTicket(input: {
  organization: { _id: mongoose.Types.ObjectId; preferences?: any };
  phoneNumber: string;
  profileName: string;
  initialIssue: string;
}): Promise<ITicket> {
  const organizationId = input.organization._id;
  const supportAiEnabled = input.organization.preferences?.supportAi?.enabled !== false;
  const customerId = await findCustomerIdByPhone(organizationId, input.phoneNumber);
  const initialIssue = input.initialIssue.trim().slice(0, 2000);
  const name = input.profileName.trim() || input.phoneNumber;

  let ticket: ITicket | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const ticketNumber = await nextTicketNumber(organizationId);
      ticket = await Ticket.create({
        organizationId,
        ticketNumber,
        ticketReference: formatTicketReference(ticketNumber),
        customerId,
        subject: initialIssue ? initialIssue.slice(0, 80) : "WhatsApp conversation",
        initialIssue,
        channel: "whatsapp",
        requester: { name, email: "", phoneNumber: input.phoneNumber },
        sessionToken: null,
        emailTranscriptRequested: false,
        botEnabled: supportAiEnabled,
        aiMode: supportAiEnabled ? "autonomous" : "paused",
        lastMessageAt: new Date(),
      });
      break;
    } catch (err: any) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
  if (!ticket) throw new Error("Failed to create WhatsApp support ticket");
  return ticket;
}

async function notifyOwnersAndAdmins(ticket: ITicket, preview: string): Promise<void> {
  const recipients = await OrganizationMember.find({
    organizationId: ticket.organizationId,
    role: { $in: ["owner", "admin"] },
  })
    .select("userId")
    .lean();
  const ticketId = String(ticket._id);
  const requester = ticket.requester.phoneNumber
    ? `${ticket.requester.name} (${ticket.requester.phoneNumber})`
    : ticket.requester.name;
  const body = preview ? `${requester}: ${preview.slice(0, 160)}` : requester;

  await Promise.allSettled(
    recipients.map((recipient) =>
      createNotificationForRecipient({
        organizationId: ticket.organizationId,
        recipientUserId: recipient.userId,
        type: "support.new_chat",
        title: "New WhatsApp conversation",
        body: body.slice(0, 200),
        actionUrl: `/support/${ticketId}`,
        entityType: "support_ticket",
        entityId: ticketId,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          requesterName: ticket.requester.name,
          requesterPhone: ticket.requester.phoneNumber ?? "",
          channel: "whatsapp",
        },
        dedupeKey: `support.new_whatsapp:${ticketId}:${recipient.userId}`,
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Inbound: message normalization
// ---------------------------------------------------------------------------

function mediaOf(message: WebhookMessage): WebhookMedia | null {
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

function fallbackFilename(message: WebhookMessage, mime: string): string {
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

/** Turns a non-text message into something an agent can read. */
function textForMessage(message: WebhookMessage): string {
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

async function mirrorMediaToStorage(
  account: IWhatsAppAccount,
  ticket: ITicket,
  message: WebhookMessage
): Promise<SupportMessageAttachmentInput | null> {
  const media = mediaOf(message);
  if (!media?.id) return null;
  try {
    const downloaded = await downloadWhatsAppMedia(account, media.id);
    const contentType = media.mime_type || downloaded.contentType;
    const originalName = media.filename?.trim() || fallbackFilename(message, contentType);
    const key = createUploadKey({
      scope: "support",
      organizationId: String(ticket.organizationId),
      fileName: originalName,
      contentType,
      size: downloaded.size,
      prefixParts: [String(ticket._id), "visitor"],
    });
    await putObjectBuffer({ key, body: downloaded.data, contentType });
    return { key, originalName, contentType, size: downloaded.size, url: null };
  } catch (err) {
    console.error(`Failed to mirror WhatsApp media ${media.id} for ticket ${ticket._id}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inbound: processing
// ---------------------------------------------------------------------------

async function loadSupportOrganization(account: IWhatsAppAccount) {
  const organization = await Organization.findOne({ _id: account.organizationId, status: "active" })
    .select("name preferences.supportAi planSlug enabledFeatures disabledFeatures")
    .lean();
  if (!organization || !hasEffectiveFeature(organization, "support")) return null;
  return organization as typeof organization & { _id: mongoose.Types.ObjectId };
}

async function handleInboundMessage(
  account: IWhatsAppAccount,
  organization: { _id: mongoose.Types.ObjectId; preferences?: any },
  message: WebhookMessage,
  profileName: string
): Promise<void> {
  // Meta retries deliveries; a wamid we've already stored is a duplicate.
  const duplicate = await TicketMessage.exists({
    organizationId: organization._id,
    externalId: message.id,
  });
  if (duplicate) return;

  // Reactions and deleted-message notices are not conversation turns.
  if (message.type === "reaction") return;

  const phoneNumber = toE164(message.from);
  if (!phoneNumber) return;
  const now = new Date();

  let ticket = await findThreadTicket(organization._id, phoneNumber, now);
  const bodyText = textForMessage(message).trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  const isNewTicket = !ticket;
  if (!ticket) {
    ticket = await createWhatsAppTicket({
      organization,
      phoneNumber,
      profileName,
      initialIssue: bodyText,
    });
  } else if (profileName && ticket.requester.name === ticket.requester.phoneNumber) {
    // Backfill the display name if we only had the number before.
    ticket.requester.name = profileName;
    await Ticket.updateOne({ _id: ticket._id }, { "requester.name": profileName });
  }

  const attachment = await mirrorMediaToStorage(account, ticket, message);
  const attachments = attachment ? [attachment] : [];
  let finalBody = bodyText;
  if (!finalBody && attachments.length === 0) {
    // Media that could not be mirrored, or a type with no text: leave a readable placeholder.
    finalBody = mediaOf(message)
      ? `[${message.type} could not be downloaded from WhatsApp]`
      : `[${message.type} message]`;
  }

  const visitorMessage = await appendVisitorMessage(ticket, finalBody, attachments);
  await TicketMessage.updateOne({ _id: visitorMessage._id }, { externalId: message.id });
  visitorMessage.externalId = message.id;

  await broadcastMessageCreated(visitorMessage);
  const fresh = await Ticket.findById(ticket._id).populate("customerId").lean();
  if (fresh) broadcastTicketUpdate(String(organization._id), serializeTicket(fresh));
  await markAccountHealthy(account, "inbound");

  if (isNewTicket) {
    try {
      await notifyOwnersAndAdmins(ticket, finalBody || (attachment ? attachment.originalName : ""));
    } catch (err) {
      console.error(`Failed to notify team of WhatsApp ticket ${ticket._id}:`, err);
    }
  }

  const current = await Ticket.findById(ticket._id);
  if (!current) return;
  const botWillReply = current.botEnabled && current.aiMode === "autonomous";

  // Blue ticks (and a typing indicator while the bot composes).
  try {
    await markWhatsAppMessageRead(account, message.id, { typing: botWillReply });
  } catch (err) {
    console.warn(`Failed to mark WhatsApp message ${message.id} as read:`, (err as Error).message);
  }

  if (!botWillReply) return;
  try {
    const botMessage = await generateSupportBotMessage(current);
    if (!botMessage) return;
    await broadcastMessageCreated(botMessage);
    await deliverTicketMessageViaWhatsApp(current, botMessage, account);
    const afterBot = await Ticket.findById(ticket._id).populate("customerId").lean();
    if (afterBot) broadcastTicketUpdate(String(organization._id), serializeTicket(afterBot));
  } catch (err) {
    console.error(`Failed to generate WhatsApp bot reply for ticket ${ticket._id}:`, err);
  }
}

function deliveryStatusFromWebhook(status: string): TicketMessageDeliveryStatus | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

const STATUS_RANK: Record<TicketMessageDeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

async function handleStatusUpdate(
  account: IWhatsAppAccount,
  status: WebhookStatus
): Promise<void> {
  const next = deliveryStatusFromWebhook(status.status);
  if (!next) return;

  const message = await TicketMessage.findOne({
    organizationId: account.organizationId,
    externalId: status.id,
  });
  if (!message) return;

  // Statuses can arrive out of order (read before delivered); never regress.
  const currentRank = message.deliveryStatus ? STATUS_RANK[message.deliveryStatus] : -1;
  if (next !== "failed" && STATUS_RANK[next] <= currentRank) return;

  message.deliveryStatus = next;
  if (next === "failed") {
    const error = status.errors?.[0];
    message.deliveryError = (error?.error_data?.details || error?.message || error?.title || "Delivery failed").slice(0, 1000);
  } else {
    message.deliveryError = null;
  }
  await message.save();
  await broadcastMessageUpdated(message);

  // A "read" receipt doubles as the customer's read marker for the thread.
  if (next === "read") {
    const readAt = new Date(Number(status.timestamp) * 1000 || Date.now());
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: message.ticketId,
        $or: [{ lastVisitorReadAt: null }, { lastVisitorReadAt: { $lt: readAt } }],
      },
      { lastVisitorReadAt: readAt },
      { returnDocument: "after" }
    )
      .populate("customerId")
      .lean();
    if (ticket) broadcastTicketUpdate(String(account.organizationId), serializeTicket(ticket));
  }
}

/**
 * Processes one `messages` change from a webhook entry. Errors are isolated per
 * message so a single bad payload never blocks the rest of the batch.
 */
export async function processWhatsAppMessagesValue(
  account: IWhatsAppAccount,
  value: WebhookMessagesValue
): Promise<void> {
  const statuses = value.statuses ?? [];
  for (const status of statuses) {
    try {
      await handleStatusUpdate(account, status);
    } catch (err) {
      console.error(`Failed to process WhatsApp status ${status.id}:`, err);
    }
  }

  const messages = value.messages ?? [];
  if (messages.length === 0) return;

  if (!account.enabled || account.status === "disabled") {
    console.warn(`WhatsApp account ${account.phoneNumberId} is disabled; ignoring ${messages.length} message(s)`);
    return;
  }
  const organization = await loadSupportOrganization(account);
  if (!organization) {
    console.warn(`Support not available for WhatsApp account ${account.phoneNumberId}; ignoring messages`);
    return;
  }

  const profileNames = new Map<string, string>();
  for (const contact of value.contacts ?? []) {
    if (contact.wa_id) profileNames.set(contact.wa_id, contact.profile?.name?.trim() ?? "");
  }

  // Sequential so a customer's burst of messages lands in order.
  for (const message of messages) {
    try {
      await handleInboundMessage(account, organization, message, profileNames.get(message.from) ?? "");
    } catch (err) {
      console.error(`Failed to process WhatsApp message ${message.id}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Outbound
// ---------------------------------------------------------------------------

async function setDelivery(
  message: ITicketMessage,
  update: {
    externalId?: string | null;
    deliveryStatus: TicketMessageDeliveryStatus;
    deliveryError?: string | null;
  }
): Promise<void> {
  message.deliveryStatus = update.deliveryStatus;
  message.deliveryError = update.deliveryError ?? null;
  if (update.externalId !== undefined) message.externalId = update.externalId;
  await TicketMessage.updateOne(
    { _id: message._id },
    {
      deliveryStatus: message.deliveryStatus,
      deliveryError: message.deliveryError,
      ...(update.externalId !== undefined ? { externalId: update.externalId } : {}),
    }
  );
  await broadcastMessageUpdated(message);
}

async function attachmentLink(attachment: ITicketMessageAttachment): Promise<string> {
  return (await createPresignedViewUrl(attachment.key)).url;
}

/**
 * Relays an agent/bot message on a WhatsApp ticket to the customer. Text goes
 * first, then each attachment as its own media message. The stored message
 * tracks the provider id of the *first* send so status webhooks can update it.
 * Failures are recorded on the message (and broadcast) rather than thrown, so
 * the agent sees them inline.
 */
export async function deliverTicketMessageViaWhatsApp(
  ticket: ITicket,
  message: ITicketMessage,
  accountOverride?: IWhatsAppAccount | null
): Promise<boolean> {
  if (ticket.channel !== "whatsapp" || message.isInternal) return false;
  const to = ticket.requester.phoneNumber ?? "";
  if (!to) {
    await setDelivery(message, { deliveryStatus: "failed", deliveryError: "Ticket has no WhatsApp number" });
    return false;
  }

  const account = accountOverride ?? (await findWhatsAppAccountForOrganization(ticket.organizationId));
  if (!account || account.status === "disabled") {
    await setDelivery(message, {
      deliveryStatus: "failed",
      deliveryError: "WhatsApp is not connected for this organization",
    });
    return false;
  }

  await setDelivery(message, { deliveryStatus: "pending" });

  let firstExternalId: string | null = null;
  try {
    const body = String(message.bodyText ?? "").trim();
    if (body) {
      const result = await sendWhatsAppText(account, to, body);
      firstExternalId = result.messageId;
    }
    for (const attachment of message.attachments ?? []) {
      const kind = whatsAppMediaKindForContentType(attachment.contentType);
      const result = await sendWhatsAppMediaLink(account, to, {
        kind,
        url: await attachmentLink(attachment),
        filename: attachment.originalName,
      });
      firstExternalId ??= result.messageId;
    }

    await setDelivery(message, { externalId: firstExternalId, deliveryStatus: "sent" });
    await markAccountHealthy(account, "outbound");
    return true;
  } catch (err) {
    const reason =
      err instanceof WhatsAppApiError ? err.agentMessage : (err as Error)?.message || "Failed to send";
    console.error(`WhatsApp delivery failed for ticket ${ticket._id} message ${message._id}:`, err);
    await setDelivery(message, {
      externalId: firstExternalId,
      deliveryStatus: "failed",
      deliveryError: reason,
    });
    if (err instanceof WhatsAppApiError && err.isAuthError) {
      await markAccountError(account, err.agentMessage);
    }
    return false;
  }
}
