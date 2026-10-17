import mongoose from "mongoose";

import { WHATSAPP_SERVICE_WINDOW_MS } from "../config/whatsapp.config";
import { Organization } from "../models/organization.model";
import { OrganizationMember } from "../models/organization-member.model";
import { Ticket, type ITicket } from "../models/ticket.model";
import {
  TicketMessage,
  type ITicketMessage,
  type ITicketMessageAttachment,
  type TicketMessageDeliveryStatus,
} from "../models/ticket-message.model";
import {
  WhatsAppAccount,
  type IWhatsAppAccount,
  type WhatsAppAccountPurpose,
} from "../models/whatsapp-account.model";
import { findCustomerIdByPhone } from "./customer-lookup.service";
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
import {
  deliveryErrorFromWebhook,
  deliveryStatusFromWebhook,
  fallbackFilename,
  mediaOf,
  shouldApplyDeliveryStatus,
  textForMessage,
  type WebhookMessage,
  type WebhookMessagesValue,
  type WebhookStatus,
} from "./whatsapp-webhook";

/**
 * A resolved/closed WhatsApp ticket is reopened (rather than a new ticket
 * created) when the customer writes again within this window.
 */
const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  organizationId: mongoose.Types.ObjectId | string,
  purpose: WhatsAppAccountPurpose = "primary"
): Promise<IWhatsAppAccount | null> {
  return WhatsAppAccount.findOne({ organizationId, purpose });
}

export async function markAccountError(account: IWhatsAppAccount, message: string): Promise<void> {
  await WhatsAppAccount.updateOne(
    { _id: account._id },
    { status: "error", errorMessage: message.slice(0, 500) }
  );
}

export async function markAccountHealthy(
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
// Inbound: media
// ---------------------------------------------------------------------------

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
  if (!shouldApplyDeliveryStatus(message.deliveryStatus, next)) return;

  message.deliveryStatus = next;
  message.deliveryError = next === "failed" ? deliveryErrorFromWebhook(status) : null;
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
