import { createElement } from "react";
import mongoose from "mongoose";

import SupportOpenedEmail from "../emails/support-opened";
import SupportResolvedEmail from "../emails/support-resolved";
import SupportTranscriptEmail from "../emails/support-transcript";
import { embedOrigin } from "../config/origins.config";
import { sendEmail } from "../lib/email";
import { Organization } from "../models/organization.model";
import { Ticket, type ITicket } from "../models/ticket.model";
import { TicketMessage } from "../models/ticket-message.model";
import { formatTicketReference } from "./ticket.service";

function formatEmailDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function messageAuthor(message: { authorType: string }, requesterName: string): string {
  if (message.authorType === "visitor") return requesterName || "Customer";
  if (message.authorType === "bot") return "Assistant";
  if (message.authorType === "agent") return "Support team";
  return "System";
}

function supportResumeUrl(ticket: ITicket | any): string | undefined {
  if (!ticket.sessionToken) return undefined;

  const url = new URL(`/support/${String(ticket.organizationId)}`, embedOrigin);
  url.searchParams.set("session", String(ticket.sessionToken));
  return url.toString();
}

async function emailPayload(ticket: ITicket | any) {
  const [organization, messages] = await Promise.all([
    Organization.findById(ticket.organizationId)
      .select("name defaultContact")
      .lean(),
    TicketMessage.find({
      ticketId: ticket._id,
      organizationId: ticket.organizationId,
      isInternal: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  if (!organization) throw new Error("Organization not found");

  return {
    organizationName: organization.name,
    requesterName: ticket.requester?.name ?? "",
    ticketReference: ticket.ticketReference || formatTicketReference(ticket.ticketNumber),
    initialIssue: ticket.initialIssue ?? ticket.subject ?? "",
    messages: messages.map((message) => ({
      author: messageAuthor(message, ticket.requester?.name ?? ""),
      bodyText: message.bodyText ?? "",
      attachments: (message.attachments ?? []).map((attachment) => attachment.originalName),
      createdAt: formatEmailDate(message.createdAt),
    })),
    rating: ticket.visitorFeedback?.rating ?? null,
    feedbackComment: ticket.visitorFeedback?.comment ?? "",
    resumeUrl: supportResumeUrl(ticket),
    replyTo: organization.defaultContact?.email ? [organization.defaultContact.email] : undefined,
  };
}

export async function sendSupportOpenedEmail(ticketId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return false;
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || !ticket.sessionToken || ticket.openedEmailSentAt) return false;

  const payload = await emailPayload(ticket);
  await sendEmail({
    to: ticket.requester.email,
    subject: `Support request #${ticket.ticketNumber} opened`,
    react: createElement(SupportOpenedEmail, payload),
    replyTo: payload.replyTo,
  });

  ticket.openedEmailSentAt = new Date();
  await ticket.save();
  return true;
}

export async function sendSupportTranscriptEmail(ticketId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return false;
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || !ticket.emailTranscriptRequested || ticket.transcriptEmailSentAt) return false;

  const payload = await emailPayload(ticket);
  await sendEmail({
    to: ticket.requester.email,
    subject: `Support transcript for ticket #${ticket.ticketNumber}`,
    react: createElement(SupportTranscriptEmail, payload),
    replyTo: payload.replyTo,
  });

  ticket.transcriptEmailSentAt = new Date();
  await ticket.save();
  return true;
}

export async function sendSupportResolvedEmail(ticketId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return false;
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || ticket.resolvedEmailSentAt) return false;

  const payload = await emailPayload(ticket);
  await sendEmail({
    to: ticket.requester.email,
    subject: `Support request #${ticket.ticketNumber} resolved`,
    react: createElement(SupportResolvedEmail, payload),
    replyTo: payload.replyTo,
  });

  ticket.resolvedEmailSentAt = new Date();
  await ticket.save();
  return true;
}

