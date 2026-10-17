import mongoose from "mongoose";

import { classifyEmail } from "../agents/check_rfq";
import { generateRFQ } from "../agents/generate_rfq";
import { WHATSAPP_SERVICE_WINDOW_MS, WHATSAPP_TEXT_MAX_LENGTH } from "../config/whatsapp.config";
import { emitDomainEvent } from "../events/domain-events";
import { InboxConversation, type IInboxConversation } from "../models/inbox-conversation.model";
import {
  InboxMessage,
  type IInboxMessage,
  type IInboxMessageAttachment,
} from "../models/inbox-message.model";
import { RFQ } from "../models/rfq.model";
import { RFQReply } from "../models/rfq-reply.model";
import type { IWhatsAppAccount } from "../models/whatsapp-account.model";
import { findCustomerIdByPhone } from "./customer-lookup.service";
import { extractRFQAttachmentText, isSupportedRFQAttachment } from "./rfq-attachment.service";
import { withRfqSlot } from "./rfq-job-queue";
import { getOrganizationContext, isQuotationProcessingEnabled } from "./rfq.service";
import { createPresignedViewUrl, createUploadKey, getObjectBuffer, putObjectBuffer } from "./storage.service";
import {
  findWhatsAppAccountForOrganization,
  markAccountError,
  markAccountHealthy,
} from "./whatsapp-support.service";
import { WHATSAPP_TEMPLATE_LANGUAGE, WHATSAPP_TEMPLATE_NAMES, isTemplateApproved } from "./whatsapp-template.service";
import {
  WhatsAppApiError,
  downloadWhatsAppMedia,
  markWhatsAppMessageRead,
  sendWhatsAppMediaLink,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  toE164,
} from "./whatsapp.service";
import {
  deliveryErrorFromWebhook,
  deliveryStatusFromWebhook,
  fallbackFilename,
  mediaOf,
  shouldApplyDeliveryStatus,
  textForMessage,
  webhookTimestamp,
  type WebhookMessage,
  type WebhookMessagesValue,
  type WebhookStatus,
} from "./whatsapp-webhook";

/**
 * Customers often type a request as a burst of short messages and photos.
 * Processing waits until the chat has been quiet this long, then reads the
 * whole burst at once.
 */
export const RFQ_QUIET_PERIOD_MS = 60_000;
const SWEEP_INTERVAL_MS = 15_000;
const MAX_CLAIMS_PER_SWEEP = 10;
/** A claim older than this belongs to a crashed or restarted worker. */
const STALE_PROCESSING_MS = 10 * 60_000;
/** An RFQ stops absorbing a chat's messages once the customer has been silent this long. */
const OPEN_RFQ_IDLE_MS = 7 * 24 * 60 * 60_000;
/** Earlier messages the classifier sees, and that a new RFQ starts from. */
const CLASSIFY_CONTEXT_MS = 24 * 60 * 60_000;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_TRANSCRIPT_MESSAGES = 150;

export class InboxChannelError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InboxChannelError";
    this.status = status;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

function rfqOwnerFor(account: IWhatsAppAccount): string | null {
  return account.ownerUserId || account.createdBy || null;
}

export function isWithinServiceWindow(conversation: Pick<IInboxConversation, "lastInboundAt">): boolean {
  return Boolean(
    conversation.lastInboundAt &&
      Date.now() - new Date(conversation.lastInboundAt).getTime() < WHATSAPP_SERVICE_WINDOW_MS
  );
}

// ---------------------------------------------------------------------------
// Inbound
// ---------------------------------------------------------------------------

async function findOrCreateConversation(
  account: IWhatsAppAccount,
  phoneNumber: string,
  profileName: string,
  sentAt: Date
): Promise<IInboxConversation | null> {
  const filter = {
    organizationId: account.organizationId,
    channel: "whatsapp" as const,
    externalId: phoneNumber,
  };
  const existing = await InboxConversation.findOne(filter);
  if (existing) return existing;

  const userId = rfqOwnerFor(account);
  if (!userId) {
    console.warn(`RFQ WhatsApp number ${account.phoneNumberId} has no owner; dropping chat from ${phoneNumber}`);
    return null;
  }
  try {
    return await InboxConversation.create({
      ...filter,
      userId,
      accountId: account._id,
      participant: { name: profileName, phoneNumber, email: null },
      customerId: await findCustomerIdByPhone(account.organizationId, phoneNumber),
      lastMessageAt: sentAt,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    return InboxConversation.findOne(filter);
  }
}

async function mirrorMediaToStorage(
  account: IWhatsAppAccount,
  conversation: IInboxConversation,
  message: WebhookMessage
): Promise<IInboxMessageAttachment | null> {
  const media = mediaOf(message);
  if (!media?.id) return null;
  try {
    const downloaded = await downloadWhatsAppMedia(account, media.id);
    const contentType = media.mime_type || downloaded.contentType;
    const originalName = media.filename?.trim() || fallbackFilename(message, contentType);
    const key = createUploadKey({
      scope: "inbox",
      organizationId: String(conversation.organizationId),
      fileName: originalName,
      contentType,
      size: downloaded.size,
      prefixParts: [String(conversation._id), "inbound"],
    });
    await putObjectBuffer({ key, body: downloaded.data, contentType });
    return { key, originalName, contentType, size: downloaded.size };
  } catch (err) {
    console.error(`Failed to mirror WhatsApp media ${media.id} for conversation ${conversation._id}:`, err);
    return null;
  }
}

async function handleInboundMessage(
  account: IWhatsAppAccount,
  message: WebhookMessage,
  profileName: string,
  scheduleRfq: boolean
): Promise<void> {
  if (message.type === "reaction") return;
  const phoneNumber = toE164(message.from);
  if (!phoneNumber) return;

  // Meta retries deliveries; a wamid we've already stored is a duplicate.
  if (await InboxMessage.exists({ organizationId: account.organizationId, externalId: message.id })) return;

  const sentAt = webhookTimestamp(message.timestamp);
  const conversation = await findOrCreateConversation(account, phoneNumber, profileName, sentAt);
  if (!conversation) return;

  const attachment = await mirrorMediaToStorage(account, conversation, message);
  let bodyText = textForMessage(message).trim().slice(0, WHATSAPP_TEXT_MAX_LENGTH);
  if (!bodyText && !attachment) {
    bodyText = mediaOf(message)
      ? `[${message.type} could not be downloaded from WhatsApp]`
      : `[${message.type} message]`;
  }

  try {
    await InboxMessage.create({
      organizationId: conversation.organizationId,
      conversationId: conversation._id,
      channel: "whatsapp",
      direction: "inbound",
      externalId: message.id,
      type: message.type,
      bodyText,
      attachments: attachment ? [attachment] : [],
      sentAt,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return;
    throw err;
  }

  await InboxConversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        accountId: account._id,
        snippet: (bodyText || attachment?.originalName || "").slice(0, 200),
        lastInboundExternalId: message.id,
        isArchived: false,
        ...(profileName ? { "participant.name": profileName } : {}),
        ...(attachment ? { hasAttachments: true } : {}),
        ...(scheduleRfq ? { rfqDueAt: new Date(Date.now() + RFQ_QUIET_PERIOD_MS) } : {}),
      },
      $max: { lastMessageAt: sentAt, lastInboundAt: sentAt },
      $inc: { messageCount: 1 },
    }
  );
}

async function handleStatusUpdate(account: IWhatsAppAccount, status: WebhookStatus): Promise<void> {
  const next = deliveryStatusFromWebhook(status.status);
  if (!next) return;

  const message = await InboxMessage.findOne({
    organizationId: account.organizationId,
    externalId: status.id,
  }).select("deliveryStatus");
  if (!message || !shouldApplyDeliveryStatus(message.deliveryStatus, next)) return;

  const deliveryError = next === "failed" ? deliveryErrorFromWebhook(status) : null;
  await InboxMessage.updateOne({ _id: message._id }, { $set: { deliveryStatus: next, deliveryError } });

  if (next === "failed") {
    await RFQReply.updateOne(
      { whatsappMessageId: status.id },
      { $set: { sendStatus: "failed", sendErrorMessage: deliveryError } }
    );
  }
}

/**
 * Processes one `messages` change for an RFQ number. Chats are always stored
 * (so nothing a customer sends is lost); RFQ processing is only scheduled
 * while the number is enabled and the organization has Quotations.
 */
export async function processRfqWhatsAppMessagesValue(
  account: IWhatsAppAccount,
  value: WebhookMessagesValue
): Promise<void> {
  for (const status of value.statuses ?? []) {
    try {
      await handleStatusUpdate(account, status);
    } catch (err) {
      console.error(`Failed to process WhatsApp status ${status.id}:`, err);
    }
  }

  const messages = value.messages ?? [];
  if (messages.length === 0) return;

  const scheduleRfq =
    account.enabled &&
    account.status !== "disabled" &&
    (await isQuotationProcessingEnabled(String(account.organizationId)));

  const profileNames = new Map<string, string>();
  for (const contact of value.contacts ?? []) {
    if (contact.wa_id) profileNames.set(contact.wa_id, contact.profile?.name?.trim() ?? "");
  }

  // Sequential so a customer's burst of messages lands in order.
  for (const message of messages) {
    try {
      await handleInboundMessage(account, message, profileNames.get(message.from) ?? "", scheduleRfq);
    } catch (err) {
      console.error(`Failed to process WhatsApp RFQ message ${message.id}:`, err);
    }
  }
  await markAccountHealthy(account, "inbound");
}

// ---------------------------------------------------------------------------
// Transcript building
// ---------------------------------------------------------------------------

function baseMimeType(contentType: string): string {
  return contentType.toLowerCase().split(";")[0]!.trim();
}

function formatTimestamp(date: Date): string {
  return `${new Date(date).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function describeAttachments(message: Pick<IInboxMessage, "attachments" | "direction">): string {
  return message.attachments
    .map((file) =>
      message.direction === "outbound"
        ? `ATTACHMENT SENT BY US: ${file.originalName}`
        : `ATTACHMENT: ${file.originalName} (${file.contentType})`
    )
    .join("\n");
}

/**
 * Text read out of an inbound message's attachments. Cached on the message so
 * a chat that is re-extracted on every follow-up only parses each file once.
 */
async function attachmentTextFor(message: IInboxMessage): Promise<string> {
  if (message.attachments.length === 0) return "";
  if (message.extractedAt) return message.extractedText ?? "";

  const sections: string[] = [];
  let cacheable = true;
  for (const file of message.attachments) {
    const mimeType = baseMimeType(file.contentType);
    if (mimeType.startsWith("audio/")) {
      sections.push(`VOICE NOTE: ${file.originalName} (not transcribed; ask the customer to type the request if it matters)`);
      continue;
    }
    const attachment = { filename: file.originalName, mimeType, size: file.size, attachmentId: file.key };
    if (!isSupportedRFQAttachment(attachment)) {
      sections.push(`ATTACHMENT: ${file.originalName} (${mimeType}, contents not readable)`);
      continue;
    }
    try {
      const extraction = await extractRFQAttachmentText({ attachment, data: await getObjectBuffer(file.key) });
      if (extraction.text) {
        sections.push(`ATTACHMENT: ${extraction.filename} (${extraction.mimeType})\n${extraction.text}`);
      } else {
        sections.push(
          `ATTACHMENT: ${extraction.filename} (${extraction.mimeType})${
            extraction.warning ? `\nExtraction warning: ${extraction.warning}` : ""
          }`
        );
      }
    } catch (err) {
      console.warn(`Could not read attachment ${file.key} for RFQ extraction:`, err);
      sections.push(`ATTACHMENT: ${file.originalName} (${mimeType}, could not be read)`);
      cacheable = false;
    }
  }

  const text = sections.join("\n\n");
  if (cacheable) {
    const extractedAt = new Date();
    await InboxMessage.updateOne({ _id: message._id }, { $set: { extractedText: text, extractedAt } });
    message.extractedText = text;
    message.extractedAt = extractedAt;
  }
  return text;
}

async function renderMessage(message: IInboxMessage, readAttachments: boolean): Promise<string> {
  const speaker = message.direction === "outbound" ? "OUR REPLY" : "CUSTOMER";
  const lines = [`[${formatTimestamp(message.sentAt)}] ${speaker}:`];
  if (message.bodyText) lines.push(message.bodyText);
  const attachments =
    readAttachments && message.direction === "inbound"
      ? await attachmentTextFor(message)
      : message.extractedText || describeAttachments(message);
  if (attachments) lines.push(attachments);
  return lines.join("\n");
}

function conversationHeading(conversation: IInboxConversation): string {
  const name = conversation.participant.name?.trim();
  return `WHATSAPP CHAT with ${name ? `${name} ` : ""}(${conversation.externalId})`;
}

async function buildConversationTranscript(
  conversation: IInboxConversation,
  startedAt: Date
): Promise<string> {
  const messages = await InboxMessage.find({
    conversationId: conversation._id,
    sentAt: { $gte: startedAt },
  })
    .sort({ sentAt: -1 })
    .limit(MAX_TRANSCRIPT_MESSAGES);
  messages.reverse();

  const rendered: string[] = [];
  for (const message of messages) rendered.push(await renderMessage(message, true));

  return [
    `${conversationHeading(conversation)}, oldest message first. The customer's request may change across messages, so extract the latest agreed state of the requested products, quantities and details. Messages labelled OUR REPLY were sent by our own team and are not the customer.`,
    ...rendered,
  ].join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// RFQ processing
// ---------------------------------------------------------------------------

/**
 * The chat's latest RFQ keeps absorbing new messages (a follow-up like "make
 * it 20" updates it) until the quote is sent, an order is placed, it is
 * archived, or the customer goes quiet for a week. After that, new messages
 * are classified afresh and may start a new RFQ.
 */
async function findOpenRFQ(conversation: IInboxConversation, at: Date) {
  if (!conversation.rfqId) return null;
  const rfq = await RFQ.findOne({
    _id: conversation.rfqId,
    isRFQ: true,
    isArchived: { $ne: true },
    workflowStatus: { $ne: "processed" },
  })
    .select("_id conversationStartedAt createdAt")
    .lean();
  if (!rfq) return null;
  if (await RFQReply.exists({ rfqId: rfq._id, sendStatus: "sent" })) return null;

  const lastFolded = await InboxMessage.findOne({
    conversationId: conversation._id,
    direction: "inbound",
    rfqId: rfq._id,
  })
    .sort({ sentAt: -1 })
    .select("sentAt")
    .lean();
  const lastActivity = lastFolded?.sentAt ?? rfq.conversationStartedAt ?? rfq.createdAt;
  if (at.getTime() - new Date(lastActivity).getTime() > OPEN_RFQ_IDLE_MS) return null;
  return rfq;
}

async function extractConversationRFQ(
  conversation: IInboxConversation,
  rfqId: mongoose.Types.ObjectId,
  startedAt: Date
): Promise<number> {
  const organizationId = String(conversation.organizationId);
  const transcript = await buildConversationTranscript(conversation, startedAt);
  const organizationContext = await getOrganizationContext(organizationId);
  const { customer, queryProducts, searchResults } = await generateRFQ(
    organizationContext,
    transcript,
    organizationId,
    {
      channel: "whatsapp",
      knownSender: {
        name: conversation.participant.name?.trim() || null,
        phoneNumber: conversation.externalId,
      },
    }
  );

  await RFQ.updateOne(
    { _id: rfqId },
    { $set: { customer, queryProducts, searchResults, isProcessed: true, errorMessage: null } }
  );

  if (!conversation.customerId) {
    const customerId = await findCustomerIdByPhone(conversation.organizationId, conversation.externalId);
    if (customerId) await InboxConversation.updateOne({ _id: conversation._id }, { $set: { customerId } });
  }
  return queryProducts.length;
}

async function extractNewRFQ(
  conversation: IInboxConversation,
  rfqId: mongoose.Types.ObjectId,
  startedAt: Date
): Promise<void> {
  try {
    const productCount = await extractConversationRFQ(conversation, rfqId, startedAt);
    console.log(`WhatsApp RFQ ${rfqId} processed: ${productCount} products found`);
    void emitDomainEvent("rfq.identified", {
      rfqId: String(rfqId),
      organizationId: String(conversation.organizationId),
      userId: conversation.userId,
    });
  } catch (err: any) {
    console.error(`WhatsApp RFQ extraction failed for ${rfqId}:`, err);
    await RFQ.updateOne(
      { _id: rfqId },
      { $set: { isProcessed: true, errorMessage: err?.message || "Unknown error" } }
    );
  }
}

async function loadClassificationContext(
  conversation: IInboxConversation,
  firstNewAt: Date
): Promise<IInboxMessage[]> {
  const windowStart = new Date(firstNewAt.getTime() - CLASSIFY_CONTEXT_MS);
  const lastFolded = await InboxMessage.findOne({
    conversationId: conversation._id,
    rfqId: { $ne: null },
    sentAt: { $lt: firstNewAt },
  })
    .sort({ sentAt: -1 })
    .select("sentAt")
    .lean();
  const from = lastFolded && lastFolded.sentAt > windowStart ? lastFolded.sentAt : windowStart;
  const context = await InboxMessage.find({
    conversationId: conversation._id,
    sentAt: { $gt: from, $lt: firstNewAt },
  })
    .sort({ sentAt: -1 })
    .limit(MAX_CONTEXT_MESSAGES);
  return context.reverse();
}

async function createRFQFromMessages(
  conversation: IInboxConversation,
  input: { startedAt: Date; reason: string; messageIds: mongoose.Types.ObjectId[] }
): Promise<mongoose.Types.ObjectId> {
  const now = new Date();
  const rfq = await RFQ.create({
    userId: conversation.userId,
    organizationId: conversation.organizationId,
    source: "whatsapp",
    inboxConversationId: conversation._id,
    conversationStartedAt: input.startedAt,
    isRFQ: true,
    reason: input.reason,
    isProcessed: false,
  });
  await InboxMessage.updateMany(
    { conversationId: conversation._id, sentAt: { $gte: input.startedAt }, rfqId: null },
    { $set: { rfqId: rfq._id } }
  );
  await InboxMessage.updateMany({ _id: { $in: input.messageIds } }, { $set: { rfqProcessedAt: now } });
  await InboxConversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        rfqId: rfq._id,
        lastClassification: { isRFQ: true, reason: input.reason, classifiedAt: now },
      },
    }
  );
  conversation.rfqId = rfq._id;
  return rfq._id;
}

async function classifyPendingMessages(
  conversation: IInboxConversation,
  pending: IInboxMessage[]
): Promise<void> {
  const firstNewAt = pending[0]!.sentAt;
  const context = await loadClassificationContext(conversation, firstNewAt);

  const sections = [conversationHeading(conversation)];
  if (context.length > 0) {
    const rendered: string[] = [];
    for (const message of context) rendered.push(await renderMessage(message, false));
    sections.push(`EARLIER MESSAGES (context only):\n\n${rendered.join("\n\n")}`);
  }
  const renderedNew: string[] = [];
  for (const message of pending) renderedNew.push(await renderMessage(message, true));
  sections.push(`NEW MESSAGES:\n\n${renderedNew.join("\n\n")}`);

  const { isRFQemail, reason } = await classifyEmail(sections.join("\n\n---\n\n"), "whatsapp");
  const pendingIds = pending.map((message) => message._id as mongoose.Types.ObjectId);

  if (!isRFQemail) {
    const now = new Date();
    await InboxMessage.updateMany({ _id: { $in: pendingIds } }, { $set: { rfqProcessedAt: now } });
    await InboxConversation.updateOne(
      { _id: conversation._id },
      { $set: { lastClassification: { isRFQ: false, reason, classifiedAt: now } } }
    );
    console.log(`WhatsApp chat ${conversation._id} classified as non-RFQ: ${reason}`);
    return;
  }

  // The request often starts with context ("Hi, Ravi from ABC Traders") the
  // classifier saw but that came before the batch, so the RFQ starts there.
  const startedAt = context.find((message) => !message.rfqId)?.sentAt ?? firstNewAt;
  const rfqId = await createRFQFromMessages(conversation, { startedAt, reason, messageIds: pendingIds });
  console.log(`WhatsApp chat ${conversation._id} classified as RFQ ${rfqId}: ${reason}`);
  await extractNewRFQ(conversation, rfqId, startedAt);
}

async function processConversation(conversationId: string): Promise<void> {
  try {
    const conversation = await InboxConversation.findById(conversationId);
    if (!conversation) return;
    if (!(await isQuotationProcessingEnabled(String(conversation.organizationId)))) return;

    const pending = await InboxMessage.find({
      conversationId: conversation._id,
      direction: "inbound",
      rfqProcessedAt: null,
    })
      .sort({ sentAt: 1 })
      .limit(MAX_TRANSCRIPT_MESSAGES);
    if (pending.length === 0) return;

    const openRFQ = await findOpenRFQ(conversation, pending[0]!.sentAt);
    if (openRFQ) {
      const startedAt = openRFQ.conversationStartedAt ?? pending[0]!.sentAt;
      const pendingIds = pending.map((message) => message._id);
      await InboxMessage.updateMany({ _id: { $in: pendingIds } }, { $set: { rfqId: openRFQ._id } });
      const productCount = await extractConversationRFQ(conversation, openRFQ._id, startedAt);
      await InboxMessage.updateMany({ _id: { $in: pendingIds } }, { $set: { rfqProcessedAt: new Date() } });
      console.log(`WhatsApp RFQ ${openRFQ._id} updated from chat follow-up: ${productCount} products found`);
    } else {
      await classifyPendingMessages(conversation, pending);
    }
    await InboxConversation.updateOne({ _id: conversation._id }, { $set: { rfqErrorMessage: null } });
  } catch (err: any) {
    // Pending messages stay unprocessed, so the next customer message (or a
    // manual reprocess from the Inbox) retries them.
    console.error(`WhatsApp RFQ processing failed for conversation ${conversationId}:`, err);
    await InboxConversation.updateOne(
      { _id: conversationId },
      { $set: { rfqErrorMessage: err?.message || "Unknown error" } }
    );
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

// Claimed conversations wait in the shared RFQ job queue, possibly longer
// than STALE_PROCESSING_MS during a burst; this set keeps the sweeper from
// reclaiming them in the meantime.
const inFlight = new Set<string>();
let sweepTimer: NodeJS.Timeout | null = null;
let sweeping = false;

function notStaleClaim(now: Date) {
  return [
    { rfqProcessingStartedAt: null },
    { rfqProcessingStartedAt: { $lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
  ];
}

async function claimNextDueConversation(): Promise<mongoose.Types.ObjectId | null> {
  const now = new Date();
  const claimed = await InboxConversation.findOneAndUpdate(
    {
      _id: { $nin: [...inFlight].map((id) => new mongoose.Types.ObjectId(id)) },
      $or: [
        { rfqDueAt: { $lte: now }, rfqProcessingStartedAt: null },
        { rfqProcessingStartedAt: { $lt: new Date(now.getTime() - STALE_PROCESSING_MS) } },
      ],
    },
    { $set: { rfqDueAt: null, rfqProcessingStartedAt: now } },
    { sort: { rfqDueAt: 1 }, returnDocument: "after", projection: { _id: 1 } }
  ).lean();
  return claimed?._id ?? null;
}

async function claimConversation(conversationId: mongoose.Types.ObjectId): Promise<boolean> {
  if (inFlight.has(String(conversationId))) return false;
  const now = new Date();
  const claimed = await InboxConversation.findOneAndUpdate(
    { _id: conversationId, $or: notStaleClaim(now) },
    { $set: { rfqDueAt: null, rfqProcessingStartedAt: now } },
    { projection: { _id: 1 } }
  ).lean();
  return Boolean(claimed);
}

async function releaseConversation(conversationId: mongoose.Types.ObjectId): Promise<void> {
  inFlight.delete(String(conversationId));
  await InboxConversation.updateOne(
    { _id: conversationId },
    { $set: { rfqProcessingStartedAt: null } }
  ).catch((err) => console.error(`Failed to release WhatsApp conversation ${conversationId}:`, err));
}

function runClaimed(conversationId: mongoose.Types.ObjectId, job: () => Promise<void>): void {
  inFlight.add(String(conversationId));
  void withRfqSlot(job)
    .catch((err) => console.error(`WhatsApp RFQ job failed for conversation ${conversationId}:`, err))
    .finally(() => releaseConversation(conversationId));
}

async function sweepDueConversations(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    for (let i = 0; i < MAX_CLAIMS_PER_SWEEP; i++) {
      const conversationId = await claimNextDueConversation();
      if (!conversationId) break;
      runClaimed(conversationId, () => processConversation(String(conversationId)));
    }
  } catch (err) {
    console.error("WhatsApp RFQ sweep failed:", err);
  } finally {
    sweeping = false;
  }
}

export function startWhatsAppRfqWorker(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => void sweepDueConversations(), SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

// ---------------------------------------------------------------------------
// Manual triggers
// ---------------------------------------------------------------------------

/** RFQ page "Retry": re-extracts a WhatsApp RFQ from its chat. */
export async function reprocessWhatsAppRFQ(rfqId: string): Promise<void> {
  const rfq = await RFQ.findById(rfqId).select("source inboxConversationId conversationStartedAt createdAt").lean();
  if (!rfq || rfq.source !== "whatsapp") return;

  const conversation = rfq.inboxConversationId
    ? await InboxConversation.findById(rfq.inboxConversationId)
    : null;
  if (!conversation) {
    await RFQ.updateOne(
      { _id: rfq._id },
      { $set: { isProcessed: true, errorMessage: "The WhatsApp chat for this RFQ no longer exists" } }
    );
    return;
  }

  await withRfqSlot(async () => {
    try {
      await extractConversationRFQ(conversation, rfq._id, rfq.conversationStartedAt ?? rfq.createdAt);
    } catch (err: any) {
      console.error(`WhatsApp RFQ reprocess failed for ${rfqId}:`, err);
      await RFQ.updateOne(
        { _id: rfq._id },
        { $set: { isProcessed: true, errorMessage: err?.message || "Unknown error" } }
      );
    }
  });
}

/**
 * Inbox "Create RFQ" / "Reprocess": refreshes the chat's open RFQ from the
 * whole conversation, or, when there is none (the classifier said no, or the
 * last RFQ is closed), turns the customer's latest messages into a new RFQ
 * without asking the classifier.
 */
export async function createOrRefreshConversationRFQ(
  conversation: IInboxConversation
): Promise<{ rfqId: string; created: boolean }> {
  const conversationId = conversation._id as mongoose.Types.ObjectId;
  if (!(await claimConversation(conversationId))) {
    throw new InboxChannelError(409, "This chat is being processed right now. Try again in a moment.");
  }

  let job: (() => Promise<void>) | null = null;
  try {
    const now = new Date();
    const pending = await InboxMessage.find({
      conversationId: conversation._id,
      direction: "inbound",
      rfqProcessedAt: null,
    }).select("_id");
    const pendingIds = pending.map((message) => message._id as mongoose.Types.ObjectId);
    const openRFQ = await findOpenRFQ(conversation, now);

    if (openRFQ) {
      const startedAt = openRFQ.conversationStartedAt ?? openRFQ.createdAt;
      await RFQ.updateOne({ _id: openRFQ._id }, { $set: { isProcessed: false, errorMessage: null } });
      job = async () => {
        try {
          await InboxMessage.updateMany({ _id: { $in: pendingIds } }, { $set: { rfqId: openRFQ._id } });
          await extractConversationRFQ(conversation, openRFQ._id, startedAt);
          await InboxMessage.updateMany({ _id: { $in: pendingIds } }, { $set: { rfqProcessedAt: new Date() } });
          await InboxConversation.updateOne({ _id: conversation._id }, { $set: { rfqErrorMessage: null } });
        } catch (err: any) {
          console.error(`WhatsApp RFQ refresh failed for ${openRFQ._id}:`, err);
          await RFQ.updateOne(
            { _id: openRFQ._id },
            { $set: { isProcessed: true, errorMessage: err?.message || "Unknown error" } }
          );
        }
      };
      return { rfqId: String(openRFQ._id), created: false };
    }

    const lastFolded = await InboxMessage.findOne({ conversationId: conversation._id, rfqId: { $ne: null } })
      .sort({ sentAt: -1 })
      .select("sentAt")
      .lean();
    const windowStart = new Date(now.getTime() - OPEN_RFQ_IDLE_MS);
    const from = lastFolded && lastFolded.sentAt > windowStart ? lastFolded.sentAt : windowStart;
    const firstMessage = await InboxMessage.findOne({
      conversationId: conversation._id,
      direction: "inbound",
      sentAt: { $gt: from },
    })
      .sort({ sentAt: 1 })
      .select("sentAt")
      .lean();
    if (!firstMessage) {
      throw new InboxChannelError(400, "There are no new customer messages in this chat to create an RFQ from.");
    }

    const rfqId = await createRFQFromMessages(conversation, {
      startedAt: firstMessage.sentAt,
      reason: "Created from the Inbox by a team member.",
      messageIds: pendingIds,
    });
    job = async () => {
      await extractNewRFQ(conversation, rfqId, firstMessage.sentAt);
      await InboxConversation.updateOne({ _id: conversation._id }, { $set: { rfqErrorMessage: null } });
    };
    return { rfqId: String(rfqId), created: true };
  } finally {
    if (job) runClaimed(conversationId, job);
    else await releaseConversation(conversationId);
  }
}

// ---------------------------------------------------------------------------
// Outbound
// ---------------------------------------------------------------------------

export async function requireRfqWhatsAppAccount(
  organizationId: mongoose.Types.ObjectId | string
): Promise<IWhatsAppAccount> {
  const account = await findWhatsAppAccountForOrganization(organizationId, "rfq");
  if (!account) {
    throw new InboxChannelError(400, "The RFQ WhatsApp number is not connected. Connect it in Settings → Integrations.");
  }
  if (!account.enabled || account.status === "disabled") {
    throw new InboxChannelError(400, "The RFQ WhatsApp number is paused. Resume it in Settings → Integrations.");
  }
  return account;
}

async function recordOutboundMessage(
  conversation: IInboxConversation,
  input: {
    externalId: string;
    type: string;
    bodyText: string;
    attachments?: IInboxMessageAttachment[];
    authorUserId: string;
    rfqId?: mongoose.Types.ObjectId | null;
  }
): Promise<IInboxMessage> {
  const sentAt = new Date();
  const attachments = input.attachments ?? [];
  const message = await InboxMessage.create({
    organizationId: conversation.organizationId,
    conversationId: conversation._id,
    channel: "whatsapp",
    direction: "outbound",
    externalId: input.externalId,
    type: input.type,
    bodyText: input.bodyText,
    attachments,
    sentAt,
    authorUserId: input.authorUserId,
    deliveryStatus: "sent",
    rfqId: input.rfqId ?? null,
  });
  await InboxConversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        snippet: (input.bodyText || attachments[0]?.originalName || "").slice(0, 200),
        lastOutboundAt: sentAt,
        ...(attachments.length > 0 ? { hasAttachments: true } : {}),
      },
      $max: { lastMessageAt: sentAt },
      $inc: { messageCount: 1 },
    }
  );
  return message;
}

async function translateSendError(account: IWhatsAppAccount, err: unknown): Promise<never> {
  if (err instanceof WhatsAppApiError) {
    if (err.isAuthError) await markAccountError(account, err.agentMessage);
    throw new InboxChannelError(502, err.agentMessage);
  }
  throw err;
}

export async function sendConversationText(
  conversation: IInboxConversation,
  text: string,
  authorUserId: string
): Promise<IInboxMessage> {
  const account = await requireRfqWhatsAppAccount(conversation.organizationId);
  if (!isWithinServiceWindow(conversation)) {
    throw new InboxChannelError(
      409,
      "WhatsApp only allows free-form replies within 24 hours of the customer's last message. Wait for the customer to write again."
    );
  }
  try {
    const { messageId } = await sendWhatsAppText(account, conversation.externalId, text);
    await markAccountHealthy(account, "outbound");
    return await recordOutboundMessage(conversation, { externalId: messageId, type: "text", bodyText: text, authorUserId });
  } catch (err) {
    return translateSendError(account, err);
  }
}

/** Best-effort blue ticks when someone on the team opens the chat. */
export async function markConversationRead(conversation: IInboxConversation): Promise<void> {
  const latest = conversation.lastInboundExternalId;
  if (!latest || latest === conversation.lastReadExternalId || !isWithinServiceWindow(conversation)) return;
  try {
    const account = await findWhatsAppAccountForOrganization(conversation.organizationId, "rfq");
    if (!account?.enabled) return;
    await markWhatsAppMessageRead(account, latest);
    await InboxConversation.updateOne({ _id: conversation._id }, { $set: { lastReadExternalId: latest } });
  } catch (err) {
    console.warn(`Failed to mark WhatsApp conversation ${conversation._id} as read:`, (err as Error).message);
  }
}

/** Template body parameters cannot contain newlines, tabs, or 4+ spaces. */
function templateText(value: string, max = 200): string {
  const clean = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return (clean || "-").slice(0, max);
}

const CAPTION_MAX_LENGTH = 1024;

/**
 * Sends a quote PDF into the chat. Inside the 24h window it goes as the
 * message text plus the document; after that Meta only allows the approved
 * `inboundr_quotation` template, which carries the PDF and a fixed body.
 * Returns the provider id of the message carrying the PDF.
 */
export async function sendQuoteOnWhatsApp(input: {
  conversation: IInboxConversation;
  rfqId: mongoose.Types.ObjectId;
  pdf: Buffer;
  filename: string;
  body: string;
  quoteReference: string;
  customerName: string;
  organizationName: string;
  authorUserId: string;
}): Promise<string> {
  const { conversation } = input;
  const account = await requireRfqWhatsAppAccount(conversation.organizationId);
  const inWindow = isWithinServiceWindow(conversation);
  if (!inWindow && !isTemplateApproved(account, "quotation")) {
    throw new InboxChannelError(
      409,
      `The customer last wrote more than 24 hours ago, so WhatsApp needs the approved "${WHATSAPP_TEMPLATE_NAMES.quotation}" template. Sync templates in Settings → Integrations and wait for Meta's approval, or ask the customer to message you first.`
    );
  }

  const key = createUploadKey({
    scope: "inbox",
    organizationId: String(conversation.organizationId),
    fileName: input.filename,
    contentType: "application/pdf",
    size: input.pdf.byteLength,
    prefixParts: [String(conversation._id), "outbound"],
  });
  await putObjectBuffer({ key, body: input.pdf, contentType: "application/pdf" });
  const { url } = await createPresignedViewUrl(key);
  const attachment: IInboxMessageAttachment = {
    key,
    originalName: input.filename,
    contentType: "application/pdf",
    size: input.pdf.byteLength,
  };
  const body = input.body.trim();

  try {
    if (!inWindow) {
      const bodyParameters = [input.customerName || "there", input.quoteReference, input.organizationName];
      const { messageId } = await sendWhatsAppTemplate(account, conversation.externalId, {
        name: WHATSAPP_TEMPLATE_NAMES.quotation,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        components: [
          {
            type: "header",
            parameters: [{ type: "document", document: { link: url, filename: input.filename } }],
          },
          {
            type: "body",
            parameters: bodyParameters.map((text) => ({ type: "text" as const, text: templateText(text) })),
          },
        ],
      });
      await recordOutboundMessage(conversation, {
        externalId: messageId,
        type: "template",
        bodyText: `Hello ${bodyParameters[0]}, thank you for your enquiry. Please find quotation ${bodyParameters[1]} from ${bodyParameters[2]} attached. Reply to this message if you have any questions or would like to place an order.`,
        attachments: [attachment],
        authorUserId: input.authorUserId,
        rfqId: input.rfqId,
      });
      await markAccountHealthy(account, "outbound");
      return messageId;
    }

    const captionFits = body.length > 0 && body.length <= CAPTION_MAX_LENGTH;
    if (body && !captionFits) {
      const text = body.slice(0, WHATSAPP_TEXT_MAX_LENGTH);
      const { messageId } = await sendWhatsAppText(account, conversation.externalId, text);
      await recordOutboundMessage(conversation, {
        externalId: messageId,
        type: "text",
        bodyText: text,
        authorUserId: input.authorUserId,
        rfqId: input.rfqId,
      });
    }
    const { messageId } = await sendWhatsAppMediaLink(account, conversation.externalId, {
      kind: "document",
      url,
      filename: input.filename,
      caption: captionFits ? body : undefined,
    });
    await recordOutboundMessage(conversation, {
      externalId: messageId,
      type: "document",
      bodyText: captionFits ? body : "",
      attachments: [attachment],
      authorUserId: input.authorUserId,
      rfqId: input.rfqId,
    });
    await markAccountHealthy(account, "outbound");
    return messageId;
  } catch (err) {
    return translateSendError(account, err);
  }
}
