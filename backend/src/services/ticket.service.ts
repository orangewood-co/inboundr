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
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function serializeTicketMessage(message: ITicketMessage | any) {
  return {
    id: String(message._id),
    ticketId: String(message.ticketId),
    authorType: message.authorType,
    authorUserId: message.authorUserId,
    bodyText: message.bodyText,
    attachments: await serializeAttachments(message.attachments ?? []),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export async function listTickets(input: {
  organizationId: mongoose.Types.ObjectId;
  status: TicketListStatus;
}) {
  const filter: Record<string, unknown> = {
    organizationId: input.organizationId,
    channel: "chat",
  };
  if (input.status !== "all") filter.status = input.status;

  const tickets = await Ticket.find(filter)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  return tickets.map(serializeTicket);
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
