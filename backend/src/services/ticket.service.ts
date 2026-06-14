import mongoose from "mongoose";

import { Ticket, type ITicket, type TicketStatus } from "../models/ticket.model";
import {
  TicketMessage,
  type ITicketMessage,
  type ITicketMessageAttachment,
} from "../models/ticket-message.model";
import { createPresignedViewUrl } from "./storage.service";

export type TicketListStatus = TicketStatus | "all";

export function normalizeTicketListStatus(value: unknown): TicketListStatus {
  return value === "all" ||
    value === "open" ||
    value === "pending" ||
    value === "resolved" ||
    value === "closed"
    ? value
    : "open";
}

async function serializeAttachments(attachments: ITicketMessageAttachment[] = []) {
  return Promise.all(
    attachments.map(async (attachment) => ({
      key: attachment.key,
      originalName: attachment.originalName,
      contentType: attachment.contentType,
      size: attachment.size,
      url: await resolveAttachmentUrl(attachment),
    }))
  );
}

async function resolveAttachmentUrl(attachment: ITicketMessageAttachment): Promise<string | null> {
  try {
    return (await createPresignedViewUrl(attachment.key)).url;
  } catch {
    return null;
  }
}

export function serializeTicket(ticket: ITicket | any) {
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    channel: ticket.channel,
    requester: ticket.requester,
    botEnabled: ticket.botEnabled,
    lastMessageAt: ticket.lastMessageAt,
    lastVisitorMessageAt: ticket.lastVisitorMessageAt,
    lastAgentMessageAt: ticket.lastAgentMessageAt,
    lastVisitorReadAt: ticket.lastVisitorReadAt,
    lastAgentReadAt: ticket.lastAgentReadAt,
    resolvedAt: ticket.resolvedAt,
    // Optional list-only fields, populated by listTickets' aggregation.
    lastMessagePreview: ticket.lastMessagePreview ?? null,
    lastMessageAuthorType: ticket.lastMessageAuthorType ?? null,
    lastMessageIsInternal: Boolean(ticket.lastMessageIsInternal),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function previewFromMessage(message: any): string {
  if (!message) return "";
  const body = String(message.bodyText ?? "").replace(/\s+/g, " ").trim();
  if (body) return body.slice(0, 140);
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length > 0) {
    const first = attachments[0];
    if (typeof first?.contentType === "string" && first.contentType.startsWith("audio/")) {
      return "Voice message";
    }
    return attachments.length === 1
      ? String(first?.originalName ?? "Attachment")
      : `${attachments.length} attachments`;
  }
  return "";
}

export async function serializeTicketMessage(message: ITicketMessage | any) {
  return {
    id: String(message._id),
    ticketId: String(message.ticketId),
    authorType: message.authorType,
    authorUserId: message.authorUserId,
    bodyText: message.bodyText,
    attachments: await serializeAttachments(message.attachments ?? []),
    isInternal: Boolean(message.isInternal),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export async function listTickets(input: {
  organizationId: mongoose.Types.ObjectId;
  status: TicketListStatus;
}) {
  const match: Record<string, unknown> = {
    organizationId: input.organizationId,
    channel: "chat",
  };
  if (input.status !== "all") match.status = input.status;

  const tickets = await Ticket.aggregate([
    { $match: match },
    { $sort: { lastMessageAt: -1, createdAt: -1 } },
    { $limit: 100 },
    {
      $lookup: {
        from: TicketMessage.collection.name,
        let: { ticketId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$ticketId", "$$ticketId"] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { bodyText: 1, authorType: 1, isInternal: 1, attachments: 1 } },
        ],
        as: "lastMessage",
      },
    },
    { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },
  ]);

  return tickets.map((ticket) =>
    serializeTicket({
      ...ticket,
      lastMessagePreview: previewFromMessage(ticket.lastMessage),
      lastMessageAuthorType: ticket.lastMessage?.authorType ?? null,
      lastMessageIsInternal: Boolean(ticket.lastMessage?.isInternal),
    })
  );
}

export async function getTicketWithMessages(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;

  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    organizationId: input.organizationId,
  }).lean();
  if (!ticket) return null;

  const messages = await TicketMessage.find({
    ticketId: ticket._id,
    organizationId: input.organizationId,
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    ticket: serializeTicket(ticket),
    messages: await Promise.all(messages.map(serializeTicketMessage)),
  };
}

export async function listRelatedTickets(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;

  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    organizationId: input.organizationId,
  })
    .select("requester.email")
    .lean();
  if (!ticket) return null;

  const email = ticket.requester?.email;
  if (!email) return [];

  const related = await Ticket.find({
    organizationId: input.organizationId,
    channel: "chat",
    _id: { $ne: ticket._id },
    "requester.email": email,
  })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(20)
    .lean();

  return related.map(serializeTicket);
}

export async function resolveTicket(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  const now = new Date();
  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    { status: "resolved", resolvedAt: now, botEnabled: false, lastMessageAt: now },
    { new: true }
  ).lean();
  return ticket ? serializeTicket(ticket) : null;
}

export async function reopenTicket(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  const now = new Date();
  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    { status: "open", resolvedAt: null, lastMessageAt: now },
    { new: true }
  ).lean();
  return ticket ? serializeTicket(ticket) : null;
}
