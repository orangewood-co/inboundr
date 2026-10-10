import mongoose from "mongoose";

import { GMAIL_SEND_SCOPE } from "../config/gmail.config";
import {
  EMAIL_ATTACHMENT_MAX_TOTAL_SIZE,
  isBlockedAttachmentFilename,
} from "../config/upload-constraints.config";
import { Customer } from "../models/customer.model";
import { Email, type IEmail } from "../models/email.model";
import { GmailAccount, type IGmailAccount } from "../models/gmail-account.model";
import { Organization } from "../models/organization.model";
import { OrganizationMember } from "../models/organization-member.model";
import { SupportAiDraft } from "../models/support-ai-draft.model";
import { Ticket, type ITicket } from "../models/ticket.model";
import {
  TicketMessage,
  type ITicketMessage,
  type TicketMessageDeliveryStatus,
} from "../models/ticket-message.model";
import { getAttachment } from "./email.service";
import { extractAddress, normalizeSubject, recordSentOutboundEmail } from "./email-reply.service";
import { extractReplyText } from "./email-triage.service";
import {
  buildReferences,
  htmlToPlainText,
  sendComposedMessage,
  splitAddressList,
  type GmailAttachment,
} from "./gmail-send.service";
import { createNotificationForRecipient } from "./notification.service";
import { createUploadKey, deleteObject, getObjectBuffer, putObjectBuffer } from "./storage.service";
import {
  appendVisitorMessage,
  generateSupportAiDraft,
  generateSupportBotMessage,
  type SupportMessageAttachmentInput,
} from "./support-chat.service";
import {
  broadcastMessageCreated,
  broadcastMessageUpdated,
  broadcastSupportAiDraftUpdate,
  broadcastTicketUpdate,
} from "./support-ws.service";
import { formatTicketReference, serializeTicket } from "./ticket.service";

/**
 * A reply on a resolved email ticket reopens it within this window; after it a
 * fresh ticket is opened on the same thread. Longer than chat/WhatsApp because
 * email follow-ups ("it broke again") routinely arrive days later.
 */
const EMAIL_REOPEN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// Inline images below this size are almost always signature logos and social
// icons rather than pasted screenshots, and would clutter every message.
const MIN_INLINE_IMAGE_BYTES = 40 * 1024;
const MAX_MIRRORED_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_MIRRORED_ATTACHMENTS = 10;

export type EmailForTicket = Pick<
  IEmail,
  | "userId"
  | "gmailAccountId"
  | "messageId"
  | "threadId"
  | "rfcMessageId"
  | "references"
  | "inReplyTo"
  | "replyTo"
  | "from"
  | "cc"
  | "subject"
  | "date"
  | "bodyText"
  | "bodyHtml"
  | "attachments"
  | "automatedReason"
  | "direction"
> & { _id: mongoose.Types.ObjectId };

// ---------------------------------------------------------------------------
// Identity and threading
// ---------------------------------------------------------------------------

function messageIdsIn(value: string | null | undefined): string[] {
  return (value ?? "").match(/<[^<>\s]+>/g) ?? [];
}

/**
 * Stable per-organization id for an email. The RFC Message-ID is shared by
 * every inbox that receives the same message, so the same email CC'd to two
 * connected inboxes lands on a ticket once.
 */
export function emailExternalId(
  email: Pick<IEmail, "rfcMessageId" | "gmailAccountId" | "messageId">
): string {
  const rfc = email.rfcMessageId?.trim() ?? "";
  return messageIdsIn(rfc)[0] ?? (rfc || `gmail:${email.gmailAccountId}:${email.messageId}`);
}

function parseMailbox(value: string): { name: string; email: string } {
  const email = extractAddress(value);
  const name = (value.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/)?.[1] ?? "").trim();
  return { name: name.toLowerCase() === email ? "" : name, email };
}

/** Reply-To wins over From: relays and web forms put the real customer there. */
function requesterFromEmail(email: EmailForTicket): { name: string; email: string } {
  const from = parseMailbox(email.from ?? "");
  const replyTo = email.replyTo?.trim() ? parseMailbox(splitAddressList(email.replyTo)[0] ?? "") : null;
  const address = replyTo?.email || from.email;
  const name = replyTo?.name || from.name || address.split("@")[0] || address;
  return { name, email: address };
}

function ticketSubject(subject: string, body: string): string {
  const stripped = subject.replace(/^(?:\s*(?:re|fwd?|fw|aw|sv)\s*:\s*)+/i, "").trim();
  return (stripped || body.replace(/\s+/g, " ").trim() || "Email conversation").slice(0, 80);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findCustomerIdByEmail(
  organizationId: mongoose.Types.ObjectId,
  email: string
): Promise<mongoose.Types.ObjectId | null> {
  if (!email) return null;
  const customers = await Customer.find({
    organizationId,
    isArchived: { $ne: true },
    email: { $regex: `^${escapeRegExp(email)}$`, $options: "i" },
  })
    .select("_id")
    .limit(2)
    .lean();
  return customers.length === 1 && customers[0] ? customers[0]._id : null;
}

/**
 * The ticket an inbound email continues: first the ticket on the same Gmail
 * thread, then any ticket holding a message this email references (a reply
 * that reached a different inbox). Resolved tickets are only continued inside
 * the reopen window.
 */
export async function findEmailTicket(
  organizationId: mongoose.Types.ObjectId,
  email: EmailForTicket
): Promise<ITicket | null> {
  let ticket = email.threadId
    ? await Ticket.findOne({
        organizationId,
        "emailThread.gmailAccountId": email.gmailAccountId,
        "emailThread.threadId": email.threadId,
        isArchived: { $ne: true },
      }).sort({ lastMessageAt: -1 })
    : null;

  if (!ticket) {
    const referencedIds = [
      ...new Set([...messageIdsIn(email.inReplyTo), ...messageIdsIn(email.references)]),
    ];
    if (referencedIds.length > 0) {
      const referenced = await TicketMessage.findOne({
        organizationId,
        externalId: { $in: referencedIds },
      })
        .sort({ createdAt: -1 })
        .select("ticketId")
        .lean();
      if (referenced) {
        ticket = await Ticket.findOne({
          _id: referenced.ticketId,
          organizationId,
          channel: "email",
          isArchived: { $ne: true },
        });
      }
    }
  }

  if (!ticket) return null;
  if (ticket.status === "open" || ticket.status === "pending") return ticket;
  const since = Date.now() - new Date(ticket.lastMessageAt ?? ticket.updatedAt).getTime();
  return since <= EMAIL_REOPEN_WINDOW_MS ? ticket : null;
}

/** The ticket that already holds this exact message (delivered to another inbox, or a retry). */
export async function findTicketIdForCapturedEmail(
  organizationId: mongoose.Types.ObjectId,
  email: EmailForTicket
): Promise<mongoose.Types.ObjectId | null> {
  const captured = await TicketMessage.findOne({
    organizationId,
    externalId: emailExternalId(email),
  })
    .select("ticketId")
    .lean();
  return captured?.ticketId ?? null;
}

export async function linkEmailToTicket(
  email: Pick<EmailForTicket, "_id">,
  ticketId: mongoose.Types.ObjectId
): Promise<void> {
  await Email.updateOne(
    { _id: email._id },
    { ticketId, status: "processed", processedAt: new Date(), errorMessage: null }
  );
}

// ---------------------------------------------------------------------------
// Inbound
// ---------------------------------------------------------------------------

async function mirrorEmailAttachments(
  account: IGmailAccount,
  ticket: ITicket,
  email: EmailForTicket
): Promise<{ attachments: SupportMessageAttachmentInput[]; skipped: string[] }> {
  const attachments: SupportMessageAttachmentInput[] = [];
  const skipped: string[] = [];

  for (const attachment of email.attachments ?? []) {
    if (attachment.inline && attachment.size < MIN_INLINE_IMAGE_BYTES) continue;
    if (
      attachments.length >= MAX_MIRRORED_ATTACHMENTS ||
      attachment.size > MAX_MIRRORED_ATTACHMENT_BYTES
    ) {
      skipped.push(attachment.filename);
      continue;
    }
    try {
      const data = await getAttachment(account, email.messageId, attachment.attachmentId);
      if (data.byteLength === 0) continue;
      const contentType = attachment.mimeType || "application/octet-stream";
      const key = createUploadKey({
        scope: "support",
        organizationId: String(ticket.organizationId),
        fileName: attachment.filename,
        contentType,
        size: data.byteLength,
        prefixParts: [String(ticket._id), "visitor"],
      });
      await putObjectBuffer({ key, body: data, contentType });
      attachments.push({
        key,
        originalName: attachment.filename,
        contentType,
        size: data.byteLength,
        url: null,
      });
    } catch (err) {
      console.error(
        `Failed to copy attachment ${attachment.filename} of email ${email.messageId} to ticket ${ticket._id}:`,
        err
      );
      skipped.push(attachment.filename);
    }
  }

  return { attachments, skipped };
}

async function notifyNewEmailTicket(ticket: ITicket, preview: string): Promise<void> {
  const recipients = await OrganizationMember.find({
    organizationId: ticket.organizationId,
    role: { $in: ["owner", "admin"] },
  })
    .select("userId")
    .lean();
  const ticketId = String(ticket._id);
  const requester = ticket.requester.email
    ? `${ticket.requester.name} <${ticket.requester.email}>`
    : ticket.requester.name;
  const body = preview ? `${requester}: ${preview.slice(0, 160)}` : requester;

  await Promise.allSettled(
    recipients.map((recipient) =>
      createNotificationForRecipient({
        organizationId: ticket.organizationId,
        recipientUserId: recipient.userId,
        type: "support.new_chat",
        title: "New email conversation",
        body: body.slice(0, 200),
        actionUrl: `/support/${ticketId}`,
        entityType: "support_ticket",
        entityId: ticketId,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          requesterName: ticket.requester.name,
          requesterEmail: ticket.requester.email,
          mailbox: ticket.emailThread?.mailbox ?? "",
          channel: "email",
        },
        dedupeKey: `support.new_email:${ticketId}:${recipient.userId}`,
      })
    )
  );
}

/**
 * Appends one email to a ticket as a customer message. Returns null when the
 * message was already captured (the unique externalId index decides races
 * between inboxes).
 */
async function appendEmailToTicket(
  account: IGmailAccount,
  email: EmailForTicket,
  ticket: ITicket
): Promise<ITicketMessage | null> {
  const externalId = emailExternalId(email);
  const linkToCapturingTicket = async () => {
    const capturedTicketId = await findTicketIdForCapturedEmail(ticket.organizationId, email);
    if (capturedTicketId) await linkEmailToTicket(email, capturedTicketId);
  };
  if (await TicketMessage.exists({ organizationId: ticket.organizationId, externalId })) {
    await linkToCapturingTicket();
    return null;
  }

  const { attachments, skipped } = await mirrorEmailAttachments(account, ticket, email);
  const notes = skipped.length > 0 ? `\n\n[Not copied from the email: ${skipped.join(", ")}]` : "";
  const body = `${extractReplyText(email)}${notes}`.trim();
  const bodyText = body || (attachments.length > 0 ? "" : "(This email has no text)");

  let message: ITicketMessage;
  try {
    message = await appendVisitorMessage(ticket, bodyText, attachments, { externalId });
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
    await Promise.allSettled(attachments.map((attachment) => deleteObject(attachment.key)));
    await linkToCapturingTicket();
    return null;
  }

  await linkEmailToTicket(email, ticket._id as mongoose.Types.ObjectId);
  await broadcastMessageCreated(message);
  const fresh = await Ticket.findById(ticket._id).populate("customerId").populate("tagIds").lean();
  if (fresh) broadcastTicketUpdate(String(ticket.organizationId), serializeTicket(fresh));
  return message;
}

/**
 * After a customer email lands: autonomous tickets get a bot reply sent back
 * on the thread; review tickets get a pending draft for an agent to approve.
 */
async function runEmailTicketAi(ticketId: mongoose.Types.ObjectId): Promise<void> {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return;
  const organization = await Organization.findById(ticket.organizationId)
    .select("preferences.supportAi")
    .lean();
  if (organization?.preferences?.supportAi?.enabled === false) return;

  if (ticket.aiMode === "autonomous" && ticket.botEnabled) {
    const botMessage = await generateSupportBotMessage(ticket);
    if (!botMessage) return;
    await broadcastMessageCreated(botMessage);
    await deliverTicketMessageViaEmail(ticket, botMessage);
    const fresh = await Ticket.findById(ticketId).populate("customerId").populate("tagIds").lean();
    if (fresh) broadcastTicketUpdate(String(ticket.organizationId), serializeTicket(fresh));
    return;
  }

  if (ticket.aiMode !== "review") return;
  // An agent may be editing the existing draft; never swap it out underneath them.
  const pending = await SupportAiDraft.exists({
    ticketId: ticket._id,
    organizationId: ticket.organizationId,
    status: "pending",
  });
  if (pending) return;
  const draft = await generateSupportAiDraft(ticket, null);
  if (draft) broadcastSupportAiDraftUpdate(String(ticket.organizationId), draft, "created");
}

function scheduleEmailTicketAi(ticketId: mongoose.Types.ObjectId): void {
  void runEmailTicketAi(ticketId).catch((err) =>
    console.error(`Support AI failed for email ticket ${ticketId}:`, err)
  );
}

/** Adds an inbound email to the conversation it continues. */
export async function continueEmailTicket(
  account: IGmailAccount,
  email: EmailForTicket,
  ticket: ITicket
): Promise<void> {
  const message = await appendEmailToTicket(account, email, ticket);
  if (message) scheduleEmailTicketAi(ticket._id as mongoose.Types.ObjectId);
}

/**
 * Opens a ticket for an inbound email. Idempotent: an email already on a
 * ticket (from another inbox or a retry) returns that ticket instead.
 */
export async function openEmailTicket(
  account: IGmailAccount,
  email: EmailForTicket,
  options: { notify?: boolean } = {}
): Promise<{ ticket: ITicket; created: boolean }> {
  const organizationId = account.organizationId;
  const capturedTicketId = await findTicketIdForCapturedEmail(organizationId, email);
  if (capturedTicketId) {
    const existing = await Ticket.findById(capturedTicketId);
    if (existing) {
      await linkEmailToTicket(email, capturedTicketId);
      return { ticket: existing, created: false };
    }
  }

  const organization = await Organization.findById(organizationId)
    .select("preferences.supportAi")
    .lean();
  const supportAiEnabled = organization?.preferences?.supportAi?.enabled !== false;
  const requester = requesterFromEmail(email);
  const customerId = await findCustomerIdByEmail(organizationId, requester.email);
  const body = extractReplyText(email);

  let ticket: ITicket | null = null;
  // ticketNumber is assigned optimistically; retry on the rare concurrent clash.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const latest = await Ticket.findOne({ organizationId })
        .sort({ ticketNumber: -1 })
        .select("ticketNumber")
        .lean();
      const ticketNumber = (latest?.ticketNumber ?? 0) + 1;
      ticket = await Ticket.create({
        organizationId,
        ticketNumber,
        ticketReference: formatTicketReference(ticketNumber),
        customerId,
        subject: ticketSubject(email.subject ?? "", body),
        initialIssue: body.slice(0, 2000),
        channel: "email",
        requester: { name: requester.name, email: requester.email, phoneNumber: "" },
        sessionToken: null,
        emailThread: {
          gmailAccountId: account._id,
          threadId: email.threadId,
          mailbox: account.emailAddress,
          subject: email.subject ?? "",
        },
        emailTranscriptRequested: false,
        // Email replies are slow to retract, so the AI drafts and a person sends.
        botEnabled: false,
        aiMode: supportAiEnabled ? "review" : "paused",
        lastMessageAt: new Date(),
      });
      break;
    } catch (err: any) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
  if (!ticket) throw new Error("Failed to create email support ticket");

  let message: ITicketMessage | null;
  try {
    message = await appendEmailToTicket(account, email, ticket);
  } catch (err) {
    await Ticket.deleteOne({ _id: ticket._id }).catch(() => undefined);
    throw err;
  }
  if (!message) {
    // Another inbox captured the same email between the check and the insert.
    await Ticket.deleteOne({ _id: ticket._id });
    const winnerId = await findTicketIdForCapturedEmail(organizationId, email);
    const winner = winnerId ? await Ticket.findById(winnerId) : null;
    if (!winner) throw new Error("Failed to attach email to support ticket");
    return { ticket: winner, created: false };
  }

  if (options.notify !== false) {
    try {
      await notifyNewEmailTicket(ticket, ticket.subject || body);
    } catch (err) {
      console.error(`Failed to notify team of email ticket ${ticket._id}:`, err);
    }
  }
  scheduleEmailTicketAi(ticket._id as mongoose.Types.ObjectId);
  return { ticket, created: true };
}

// ---------------------------------------------------------------------------
// Outbound
// ---------------------------------------------------------------------------

class EmailDeliveryError extends Error {}

/** Why agent replies on an email ticket cannot be sent right now, or null when they can. */
async function loadReplyAccount(
  ticket: Pick<ITicket, "organizationId" | "emailThread" | "requester">
): Promise<{ account: IGmailAccount | null; blockedReason: string | null }> {
  const thread = ticket.emailThread;
  if (!thread) {
    return { account: null, blockedReason: "This ticket is not linked to an email conversation" };
  }
  if (!ticket.requester?.email) {
    return { account: null, blockedReason: "This ticket has no customer email address" };
  }
  const account = await GmailAccount.findOne({
    _id: thread.gmailAccountId,
    organizationId: ticket.organizationId,
  });
  if (!account || account.status === "revoked") {
    return {
      account: null,
      blockedReason: `${thread.mailbox} is no longer connected. Reconnect it in Settings to send replies.`,
    };
  }
  if (account.status !== "connected") {
    return {
      account,
      blockedReason: `${thread.mailbox} needs to be reconnected in Settings before replies can be sent.`,
    };
  }
  if (!account.scope.includes(GMAIL_SEND_SCOPE)) {
    return {
      account,
      blockedReason: `${thread.mailbox} was connected without permission to send mail. Reconnect it in Settings to grant it.`,
    };
  }
  return { account, blockedReason: null };
}

export async function describeEmailChannel(
  ticket: Pick<ITicket, "organizationId" | "emailThread" | "requester">
): Promise<{ mailbox: string; canSend: boolean; blockedReason: string | null } | null> {
  if (!ticket.emailThread) return null;
  const { blockedReason } = await loadReplyAccount(ticket);
  return { mailbox: ticket.emailThread.mailbox, canSend: !blockedReason, blockedReason };
}

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(escaped: string): string {
  return escaped.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (url) => `<a href="${url}">${url}</a>`);
}

function renderReplyBody(bodyText: string, signatureHtml: string | null): { text: string; html: string } {
  const body = bodyText.trim();
  const paragraphs = body
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 12px">${linkify(escapeHtml(paragraph)).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">`,
    paragraphs,
    signatureHtml ? `<div class="inboundr_signature" style="margin-top:16px">${signatureHtml}</div>` : "",
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");
  const text = signatureHtml ? `${body}\n\n-- \n${htmlToPlainText(signatureHtml)}` : body;
  return { text, html };
}

function formatAddress(name: string, email: string): string {
  const clean = name.replace(/["<>\r\n]/g, "").trim();
  return clean && clean.toLowerCase() !== email.toLowerCase() ? `"${clean}" <${email}>` : email;
}

/**
 * Keeps the customer's CC'd colleagues on the conversation. To-addresses are
 * not carried over: that is where the support alias itself usually sits.
 */
async function replyCc(
  ticket: ITicket,
  account: IGmailAccount,
  latestInbound: Pick<IEmail, "cc"> | null
): Promise<string | undefined> {
  if (!latestInbound?.cc) return undefined;
  const inboxes = await GmailAccount.find({ organizationId: ticket.organizationId })
    .select("emailAddress")
    .lean();
  const excluded = new Set(
    [account.emailAddress, ticket.requester.email, ...inboxes.map((inbox) => inbox.emailAddress)]
      .map((address) => address.toLowerCase())
      .filter(Boolean)
  );
  const cc = splitAddressList(latestInbound.cc).filter((entry) => {
    const address = extractAddress(entry);
    if (!address || excluded.has(address)) return false;
    excluded.add(address);
    return true;
  });
  return cc.length > 0 ? cc.join(", ") : undefined;
}

async function loadOutboundAttachments(message: ITicketMessage): Promise<GmailAttachment[]> {
  const attachments: GmailAttachment[] = [];
  let totalBytes = 0;
  for (const attachment of message.attachments ?? []) {
    if (isBlockedAttachmentFilename(attachment.originalName)) {
      throw new EmailDeliveryError(`${attachment.originalName} cannot be sent by email`);
    }
    const content = await getObjectBuffer(attachment.key);
    totalBytes += content.byteLength;
    if (totalBytes > EMAIL_ATTACHMENT_MAX_TOTAL_SIZE) {
      const limitMb = Math.round(EMAIL_ATTACHMENT_MAX_TOTAL_SIZE / 1024 / 1024);
      throw new EmailDeliveryError(`Attachments must total ${limitMb}MB or less to send by email`);
    }
    attachments.push({
      filename: attachment.originalName,
      contentType: attachment.contentType,
      content,
    });
  }
  return attachments;
}

function gmailErrorMessage(err: unknown, mailbox: string): string {
  if (err instanceof EmailDeliveryError) return err.message;
  const anyErr = err as any;
  const detail =
    anyErr?.response?.data?.error?.message ??
    anyErr?.response?.data?.error_description ??
    anyErr?.message ??
    "";
  if (/invalid_grant|invalid credentials|unauthenticated/i.test(String(detail))) {
    return `${mailbox} needs to be reconnected in Settings before replies can be sent.`;
  }
  return String(detail || "Failed to send the email").slice(0, 500);
}

/**
 * Sends an agent/bot message on an email ticket as a reply on the original
 * Gmail thread, from the inbox the conversation came in on. The outcome is
 * written onto the message (and broadcast) rather than thrown, so the agent
 * sees failures inline.
 */
export async function deliverTicketMessageViaEmail(
  ticket: ITicket,
  message: ITicketMessage
): Promise<boolean> {
  if (ticket.channel !== "email" || message.isInternal) return false;

  const { account, blockedReason } = await loadReplyAccount(ticket);
  const thread = ticket.emailThread;
  if (!account || blockedReason || !thread) {
    await setDelivery(message, {
      deliveryStatus: "failed",
      deliveryError: blockedReason ?? "Email is not available for this ticket",
    });
    return false;
  }

  await setDelivery(message, { deliveryStatus: "pending" });

  let sentMessageId: string | null = null;
  let anchor: IEmail | null = null;
  try {
    // The newest stored message on the thread anchors In-Reply-To/References.
    const threadEmails = {
      gmailAccountId: account._id,
      threadId: thread.threadId,
      messageId: { $type: "string" as const },
    };
    const [latest, latestInbound] = await Promise.all([
      Email.findOne(threadEmails).sort({ date: -1 }),
      Email.findOne({ ...threadEmails, direction: { $ne: "outbound" } })
        .sort({ date: -1 })
        .select("cc")
        .lean(),
    ]);
    anchor = latest;

    const attachments = await loadOutboundAttachments(message);
    const { text, html } = renderReplyBody(String(message.bodyText ?? ""), account.signatureHtml);

    sentMessageId = await sendComposedMessage({
      account,
      threadId: thread.threadId,
      headers: {
        From: account.emailAddress,
        To: formatAddress(ticket.requester.name, ticket.requester.email),
        Cc: await replyCc(ticket, account, latestInbound),
        Subject: normalizeSubject(thread.subject || anchor?.subject || ticket.subject, "reply"),
        "In-Reply-To": anchor?.rfcMessageId ?? undefined,
        References: anchor ? buildReferences(anchor) : undefined,
      },
      text,
      html,
      attachments,
    });
    if (!sentMessageId) throw new EmailDeliveryError("Gmail did not return a message id");
  } catch (err) {
    console.error(`Email delivery failed for ticket ${ticket._id} message ${message._id}:`, err);
    await setDelivery(message, {
      deliveryStatus: "failed",
      deliveryError: gmailErrorMessage(err, thread.mailbox),
    });
    return false;
  }

  // The reply is already on its way; bookkeeping failures must not mark it failed.
  let externalId = `gmail:${account._id}:${sentMessageId}`;
  try {
    if (anchor) {
      const sent = await recordSentOutboundEmail({ account, sourceEmail: anchor, sentMessageId });
      if (sent) {
        await Email.updateOne({ _id: sent._id }, { ticketId: ticket._id });
        if (sent.rfcMessageId) externalId = emailExternalId(sent);
      }
    }
  } catch (err) {
    console.error(`Failed to record sent email ${sentMessageId} for ticket ${ticket._id}:`, err);
  }

  try {
    await setDelivery(message, { externalId, deliveryStatus: "sent" });
  } catch (err) {
    console.error(`Failed to store delivery for ticket message ${message._id}:`, err);
    await setDelivery(message, { deliveryStatus: "sent" }).catch(() => undefined);
  }
  return true;
}
