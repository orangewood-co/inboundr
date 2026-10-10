import mongoose from "mongoose";

import { triageEmail } from "../agents/triage_email";
import type { IEmail } from "../models/email.model";
import type { IGmailAccount } from "../models/gmail-account.model";
import { Organization } from "../models/organization.model";
import { RFQ } from "../models/rfq.model";
import { updateEmailStatus } from "./email.service";
import {
  continueEmailTicket,
  findEmailTicket,
  findTicketIdForCapturedEmail,
  linkEmailToTicket,
  openEmailTicket,
  type EmailForTicket,
} from "./email-ticket.service";
import { extractReplyText } from "./email-triage.service";
import { hasEffectiveFeature } from "./entitlement.service";
import { buildRFQProcessingInput, hasRFQProcessableContent } from "./rfq-input.service";
import { processEmailForRFQ } from "./rfq.service";

// RFQ processing runs an LLM call plus Postgres product searches per email.
// A backlog catch-up can ingest dozens of emails in seconds; firing all their
// RFQ jobs at once exhausts the session-mode Postgres pooler (pool_size 20),
// so queue them behind a small semaphore instead.
const MAX_CONCURRENT_RFQ_JOBS = 2;
let activeRfqJobs = 0;
const rfqJobWaiters: Array<() => void> = [];

async function withRfqSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (activeRfqJobs >= MAX_CONCURRENT_RFQ_JOBS) {
    await new Promise<void>((resolve) => rfqJobWaiters.push(resolve));
  }
  activeRfqJobs++;
  try {
    return await fn();
  } finally {
    activeRfqJobs--;
    rfqJobWaiters.shift()?.();
  }
}

export type RoutableEmail = EmailForTicket &
  Pick<IEmail, "to" | "snippet"> & {
    organizationId: mongoose.Types.ObjectId;
  };

async function queueRfqProcessing(
  account: IGmailAccount,
  email: RoutableEmail,
  classification?: { isRFQemail: boolean; reason: string }
): Promise<void> {
  if (!hasRFQProcessableContent(email)) return;
  const body = await buildRFQProcessingInput(account, email);
  withRfqSlot(() =>
    processEmailForRFQ(
      email._id.toString(),
      body,
      email.messageId,
      account.userId,
      account._id.toString(),
      account.organizationId?.toString(),
      { threadId: email.threadId ?? null, classification }
    )
  ).catch((err) => console.error(`RFQ processing failed for ${email.messageId}:`, err));
}

/** Non-RFQ triage outcomes are still recorded so the Inbox shows why the email was not an RFQ. */
async function recordNotRfq(account: IGmailAccount, email: RoutableEmail, reason: string): Promise<void> {
  await processEmailForRFQ(
    email._id.toString(),
    "",
    email.messageId,
    account.userId,
    account._id.toString(),
    account.organizationId?.toString(),
    { threadId: email.threadId ?? null, classification: { isRFQemail: false, reason } }
  );
}

async function markHandled(account: IGmailAccount, email: RoutableEmail): Promise<void> {
  await updateEmailStatus(email.messageId, "processed", undefined, account._id.toString());
}

function triageInput(email: RoutableEmail): string {
  const attachments = (email.attachments ?? [])
    .filter((attachment) => !attachment.inline)
    .map((attachment) => attachment.filename);
  const header = [`From: ${email.from}`, `Subject: ${email.subject || "(no subject)"}`];
  if (attachments.length > 0) header.push(`Attachments: ${attachments.join(", ")}`);
  const body = extractReplyText(email).slice(0, 6000) || email.snippet || "";
  return `${header.join("\n")}\n\n${body}`;
}

/**
 * Decides where a newly stored inbound email goes, based on the inbox purpose
 * and what the organization has enabled:
 *
 * 1. Replies on a conversation that is already a ticket stay on that ticket.
 * 2. Replies on an RFQ thread keep updating the RFQ.
 * 3. Quotations-only inboxes behave exactly as before (RFQ classification).
 * 4. Support-only inboxes open a ticket for every human-sent email.
 * 5. Mixed inboxes ask the triage classifier: RFQ, support ticket, or leave it
 *    in the Inbox (with a manual "Create ticket" action).
 *
 * Machine-sent mail never opens a ticket.
 */
export async function routeInboundEmail(account: IGmailAccount, email: RoutableEmail): Promise<void> {
  const organization = await Organization.findById(account.organizationId)
    .select("name planSlug enabledFeatures disabledFeatures")
    .lean();
  if (!organization) return;

  const supportOn = hasEffectiveFeature(organization, "support");
  const quotationsOn = hasEffectiveFeature(organization, "rfq");
  const purpose = account.purpose ?? "quotations";
  const feedsQuotations = quotationsOn && purpose !== "support";
  const feedsSupport = supportOn && purpose !== "quotations";

  let alreadyOnTicket = false;
  if (supportOn) {
    const capturedTicketId = await findTicketIdForCapturedEmail(organization._id, email);
    if (capturedTicketId) {
      alreadyOnTicket = true;
      await linkEmailToTicket(email, capturedTicketId);
      if (!feedsQuotations) return;
    } else {
      const ticket = await findEmailTicket(organization._id, email);
      if (ticket) {
        if (email.automatedReason) await markHandled(account, email);
        else await continueEmailTicket(account, email, ticket);
        return;
      }
    }
  }

  if (
    feedsQuotations &&
    email.threadId &&
    (await RFQ.exists({ gmailAccountId: account._id, threadId: email.threadId, isRFQ: true }))
  ) {
    await queueRfqProcessing(account, email);
    return;
  }

  // Mail that predates the inbox connection only reaches us through backfills;
  // turning it into tickets would flood Support with stale conversations.
  const predatesConnection = new Date(email.date).getTime() < new Date(account.createdAt).getTime();
  if (!feedsSupport || alreadyOnTicket || email.automatedReason || predatesConnection) {
    if (feedsQuotations) await queueRfqProcessing(account, email);
    else await markHandled(account, email);
    return;
  }

  if (!feedsQuotations) {
    await openEmailTicket(account, email);
    return;
  }

  let triage: Awaited<ReturnType<typeof triageEmail>>;
  try {
    triage = await triageEmail(triageInput(email), organization.name);
  } catch (err) {
    console.error(`Email triage failed for ${email.messageId}; falling back to RFQ handling:`, err);
    await queueRfqProcessing(account, email);
    return;
  }

  if (triage.category === "rfq") {
    await queueRfqProcessing(account, email, { isRFQemail: true, reason: triage.reason });
    return;
  }
  if (triage.category === "support") {
    await openEmailTicket(account, email);
  }
  await recordNotRfq(account, email, triage.reason);
}
