import mongoose from "mongoose";

import { Customer } from "../models/customer.model";
import { SupportTicketTag } from "../models/support-ticket-tag.model";
import { Ticket, type ITicket, type TicketStatus } from "../models/ticket.model";
import { SupportAiDraft, type ISupportAiDraft } from "../models/support-ai-draft.model";
import {
  TicketMessage,
  type ITicketMessage,
  type ITicketMessageAttachment,
} from "../models/ticket-message.model";
import { createPresignedViewUrl, deleteObject } from "./storage.service";
import { sendSupportResolvedEmail } from "./support-email.service";
import { resolveUsersByIds } from "./user-lookup.service";

export type TicketListStatus = TicketStatus | "all" | "archived";

export interface TicketAgent {
  userId: string;
  name: string;
  image: string | null;
}

export function formatTicketReference(ticketNumber: number): string {
  return `SR-${String(ticketNumber).padStart(6, "0")}`;
}

export function normalizeTicketAiMode(ticket: Pick<any, "aiMode" | "botEnabled">) {
  return ticket.aiMode === "autonomous" ||
    ticket.aiMode === "review" ||
    ticket.aiMode === "paused"
    ? ticket.aiMode
    : ticket.botEnabled
      ? "autonomous"
      : "paused";
}

export function serializeCustomer(customer: any) {
  if (!customer) return null;
  return {
    id: String(customer._id),
    name: customer.name,
    company: customer.company,
    email: customer.email,
    contactNumber: customer.contactNumber ?? null,
    address: customer.address ?? null,
    specialDiscountPercentage: customer.specialDiscountPercentage ?? 0,
  };
}

function customerIdFromTicket(ticket: any): string | null {
  if (!ticket.customerId) return null;
  return String(ticket.customerId._id ?? ticket.customerId);
}

function customerFromTicket(ticket: any) {
  const candidate = ticket.customer ?? ticket.customerId;
  return candidate && typeof candidate === "object" && "email" in candidate ? candidate : null;
}

export function serializeTicketTags(ticket: any) {
  const source = Array.isArray(ticket.tags)
    ? ticket.tags
    : Array.isArray(ticket.tagIds)
      ? ticket.tagIds
      : [];
  return source
    .filter((tag: any) => tag && typeof tag === "object" && "name" in tag)
    .map((tag: any) => ({
      id: String(tag._id),
      name: tag.name,
      color: tag.color ?? "slate",
    }));
}

export function normalizeTicketListStatus(value: unknown): TicketListStatus {
  return value === "all" ||
    value === "open" ||
    value === "pending" ||
    value === "resolved" ||
    value === "closed" ||
    value === "archived"
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
  const aiMode = normalizeTicketAiMode(ticket);
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    ticketReference: ticket.ticketReference || formatTicketReference(ticket.ticketNumber),
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    channel: ticket.channel,
    requester: ticket.requester,
    tags: serializeTicketTags(ticket),
    customerId: customerIdFromTicket(ticket),
    customer: serializeCustomer(customerFromTicket(ticket)),
    initialIssue: ticket.initialIssue ?? "",
    emailTranscriptRequested: Boolean(ticket.emailTranscriptRequested),
    botEnabled: aiMode === "autonomous",
    aiMode,
    lastMessageAt: ticket.lastMessageAt,
    lastVisitorMessageAt: ticket.lastVisitorMessageAt,
    lastAgentMessageAt: ticket.lastAgentMessageAt,
    lastVisitorReadAt: ticket.lastVisitorReadAt,
    lastAgentReadAt: ticket.lastAgentReadAt,
    visitorEndedAt: ticket.visitorEndedAt ?? null,
    visitorFeedback: {
      rating: ticket.visitorFeedback?.rating ?? null,
      comment: ticket.visitorFeedback?.comment ?? "",
      submittedAt: ticket.visitorFeedback?.submittedAt ?? null,
    },
    transcriptEmailSentAt: ticket.transcriptEmailSentAt ?? null,
    resolvedEmailSentAt: ticket.resolvedEmailSentAt ?? null,
    resolvedAt: ticket.resolvedAt,
    isArchived: Boolean(ticket.isArchived),
    archivedAt: ticket.archivedAt ?? null,
    // Optional list-only fields, populated by listTickets' aggregation.
    lastMessagePreview: ticket.lastMessagePreview ?? null,
    lastMessageAuthorType: ticket.lastMessageAuthorType ?? null,
    lastMessageIsInternal: Boolean(ticket.lastMessageIsInternal),
    agents: ticket.agents ?? null,
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

export function serializeSupportAiDraft(draft: ISupportAiDraft | any) {
  return {
    id: String(draft._id),
    ticketId: String(draft.ticketId),
    organizationId: String(draft.organizationId),
    bodyText: draft.bodyText,
    status: draft.status,
    requestedByUserId: draft.requestedByUserId ?? null,
    approvedByUserId: draft.approvedByUserId ?? null,
    rejectedByUserId: draft.rejectedByUserId ?? null,
    sourceArticleIds: (draft.sourceArticleIds ?? []).map((id: unknown) => String(id)),
    sourceTemplateIds: (draft.sourceTemplateIds ?? []).map((id: unknown) => String(id)),
    model: draft.modelName ?? draft.model ?? "",
    escalationReason: draft.escalationReason ?? "",
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

const DEFAULT_TICKET_PAGE_SIZE = 25;
const MAX_TICKET_PAGE_SIZE = 100;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listTickets(input: {
  organizationId: mongoose.Types.ObjectId;
  status: TicketListStatus;
  search?: string;
  tagIds?: string[];
  page?: number;
  limit?: number;
}) {
  const match: Record<string, unknown> = {
    organizationId: input.organizationId,
    channel: { $in: ["chat", "phone"] },
  };
  if (input.status === "archived") {
    match.isArchived = true;
  } else {
    match.isArchived = { $ne: true };
    if (input.status !== "all") match.status = input.status;
  }

  const tagIds = (input.tagIds ?? [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (tagIds.length > 0) {
    match.tagIds = { $in: tagIds };
  }

  const search = String(input.search ?? "").trim();
  if (search) {
    const pattern = escapeRegExp(search);
    const or: Record<string, unknown>[] = [
      { subject: { $regex: pattern, $options: "i" } },
      { "requester.name": { $regex: pattern, $options: "i" } },
      { "requester.email": { $regex: pattern, $options: "i" } },
      { ticketReference: { $regex: pattern, $options: "i" } },
    ];
    const asNumber = Number(search.replace(/^#/, "").replace(/^SR-?/i, ""));
    if (Number.isInteger(asNumber) && asNumber > 0) {
      or.push({ ticketNumber: asNumber });
    }
    match.$or = or;
  }

  const limit = Math.min(
    Math.max(Math.trunc(input.limit ?? DEFAULT_TICKET_PAGE_SIZE) || DEFAULT_TICKET_PAGE_SIZE, 1),
    MAX_TICKET_PAGE_SIZE
  );
  const page = Math.max(Math.trunc(input.page ?? 1) || 1, 1);
  const skip = (page - 1) * limit;

  const [result] = await Ticket.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: "value" }],
        data: [
          { $sort: { lastMessageAt: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
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
          {
            $lookup: {
              from: TicketMessage.collection.name,
              let: { ticketId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$ticketId", "$$ticketId"] },
                        { $eq: ["$authorType", "agent"] },
                        { $ne: ["$authorUserId", null] },
                      ],
                    },
                  },
                },
                { $group: { _id: "$authorUserId", firstAt: { $min: "$createdAt" } } },
                { $sort: { firstAt: 1 } },
              ],
              as: "agentIds",
            },
          },
          {
            $lookup: {
              from: Customer.collection.name,
              localField: "customerId",
              foreignField: "_id",
              as: "customer",
            },
          },
          {
            $lookup: {
              from: SupportTicketTag.collection.name,
              localField: "tagIds",
              foreignField: "_id",
              as: "tags",
            },
          },
          { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },
          { $addFields: { customer: { $arrayElemAt: ["$customer", 0] } } },
        ],
      },
    },
  ]);

  const total: number = result?.total?.[0]?.value ?? 0;
  const data: any[] = result?.data ?? [];

  const allAgentIds = data.flatMap((ticket: any) =>
    Array.isArray(ticket.agentIds)
      ? ticket.agentIds.map((entry: any) => String(entry._id)).filter(Boolean)
      : []
  );
  const userMap = await resolveUsersByIds(allAgentIds);

  const tickets = data.map((ticket: any) => {
    const agents: TicketAgent[] = (Array.isArray(ticket.agentIds) ? ticket.agentIds : [])
      .map((entry: any) => {
        const userId = String(entry._id);
        const user = userMap.get(userId);
        return {
          userId,
          name: user?.name ?? user?.email ?? "Agent",
          image: user?.image ?? null,
        };
      });

    return serializeTicket({
      ...ticket,
      lastMessagePreview: previewFromMessage(ticket.lastMessage),
      lastMessageAuthorType: ticket.lastMessage?.authorType ?? null,
      lastMessageIsInternal: Boolean(ticket.lastMessage?.isInternal),
      agents,
    });
  });

  return { tickets, total, page, limit };
}

export async function getTicketWithMessages(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;

  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    organizationId: input.organizationId,
  })
    .populate("customerId")
    .populate("tagIds")
    .lean();
  if (!ticket) return null;

  const messages = await TicketMessage.find({
    ticketId: ticket._id,
    organizationId: input.organizationId,
  })
    .sort({ createdAt: 1 })
    .lean();
  const drafts = await SupportAiDraft.find({
    ticketId: ticket._id,
    organizationId: input.organizationId,
    status: "pending",
  })
    .sort({ createdAt: 1 })
    .lean();

  return {
    ticket: serializeTicket(ticket),
    messages: await Promise.all(messages.map(serializeTicketMessage)),
    aiDrafts: drafts.map(serializeSupportAiDraft),
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
    channel: { $in: ["chat", "phone"] },
    _id: { $ne: ticket._id },
    "requester.email": email,
  })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(20)
    .lean();

  return related.map(serializeTicket);
}

export async function listCustomerCandidates(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  search?: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;

  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    organizationId: input.organizationId,
  }).lean();
  if (!ticket) return null;

  const search = String(input.search ?? "").trim();
  const requesterEmail = ticket.requester?.email ?? "";
  const requesterName = ticket.requester?.name ?? "";
  const baseFilter = {
    organizationId: input.organizationId,
    isArchived: { $ne: true },
  };

  const filter = search
    ? {
        ...baseFilter,
        $or: ["name", "company", "email", "contactNumber"].map((field) => ({
          [field]: { $regex: search, $options: "i" },
        })),
      }
    : {
        ...baseFilter,
        $or: [
          { email: requesterEmail },
          { name: { $regex: requesterName, $options: "i" } },
          { company: { $regex: requesterName, $options: "i" } },
        ],
      };

  const customers = await Customer.find(filter).sort({ updatedAt: -1 }).limit(10).lean();
  return {
    linkedCustomerId: customerIdFromTicket(ticket),
    candidates: customers.map(serializeCustomer),
  };
}

export async function linkTicketCustomer(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  customerId: string | null;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  if (input.customerId && !mongoose.Types.ObjectId.isValid(input.customerId)) return null;

  if (input.customerId) {
    const customer = await Customer.findOne({
      _id: input.customerId,
      organizationId: input.organizationId,
      isArchived: { $ne: true },
    }).lean();
    if (!customer) return null;
  }

  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    { customerId: input.customerId ? new mongoose.Types.ObjectId(input.customerId) : null },
    { new: true }
  )
    .populate("customerId")
    .populate("tagIds")
    .lean();

  return ticket ? serializeTicket(ticket) : null;
}

export async function createAndLinkTicketCustomer(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  company?: string;
  contactNumber?: string;
  address?: string;
  notes?: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  const ticket = await Ticket.findOne({
    _id: input.ticketId,
    organizationId: input.organizationId,
  }).lean();
  if (!ticket) return null;

  const customer = await Customer.create({
    organizationId: input.organizationId,
    name: ticket.requester.name,
    company: String(input.company ?? ticket.requester.name).trim() || ticket.requester.name,
    email: ticket.requester.email,
    contactNumber:
      String(input.contactNumber ?? "").trim() ||
      String(ticket.requester.phoneNumber ?? "").trim() ||
      null,
    address: String(input.address ?? "").trim() || null,
    notes: String(input.notes ?? "Created from support conversation").trim() || null,
  });

  const linked = await linkTicketCustomer({
    organizationId: input.organizationId,
    ticketId: input.ticketId,
    customerId: String(customer._id),
  });

  return linked;
}

export async function resolveTicket(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  const now = new Date();
  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    {
      status: "resolved",
      resolvedAt: now,
      botEnabled: false,
      aiMode: "paused",
      lastMessageAt: now,
    },
    { new: true }
  ).lean();
  if (!ticket) return null;
  try {
    await sendSupportResolvedEmail(String(ticket._id));
  } catch (err) {
    console.error(`Failed to send support resolution email for ticket ${ticket._id}:`, err);
  }
  const fresh = await Ticket.findById(ticket._id)
    .populate("customerId")
    .populate("tagIds")
    .lean();
  return fresh ? serializeTicket(fresh) : serializeTicket(ticket);
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
  if (!ticket) return null;
  const fresh = await Ticket.findById(ticket._id)
    .populate("customerId")
    .populate("tagIds")
    .lean();
  return fresh ? serializeTicket(fresh) : serializeTicket(ticket);
}

export async function setTicketArchived(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  archived: boolean;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;
  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    { isArchived: input.archived, archivedAt: input.archived ? new Date() : null },
    { new: true }
  )
    .populate("customerId")
    .populate("tagIds")
    .lean();
  return ticket ? serializeTicket(ticket) : null;
}

export async function updateTicketTags(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
  tagIds: string[];
}) {
  if (!mongoose.Types.ObjectId.isValid(input.ticketId)) return null;

  const requestedIds = [
    ...new Set(input.tagIds.filter((id) => mongoose.Types.ObjectId.isValid(id))),
  ];

  const validTags = await SupportTicketTag.find({
    _id: { $in: requestedIds },
    organizationId: input.organizationId,
  })
    .select("_id")
    .lean();
  const validIds = validTags.map((tag) => tag._id as mongoose.Types.ObjectId);

  const ticket = await Ticket.findOneAndUpdate(
    { _id: input.ticketId, organizationId: input.organizationId },
    { tagIds: validIds },
    { new: true }
  )
    .populate("customerId")
    .populate("tagIds")
    .lean();

  return ticket ? serializeTicket(ticket) : null;
}

export async function deleteTicket(input: {
  organizationId: mongoose.Types.ObjectId;
  ticketId: string;
}): Promise<boolean | null> {
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
    .select("attachments")
    .lean();

  const keys = [
    ...new Set(
      messages.flatMap((message) =>
        (message.attachments ?? []).map((attachment) => attachment.key).filter(Boolean)
      )
    ),
  ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key);
      } catch (err) {
        console.error(`Failed to delete support attachment ${key}:`, err);
      }
    })
  );

  await TicketMessage.deleteMany({ ticketId: ticket._id, organizationId: input.organizationId });
  await SupportAiDraft.deleteMany({ ticketId: ticket._id, organizationId: input.organizationId });
  await Ticket.deleteOne({ _id: ticket._id, organizationId: input.organizationId });

  return true;
}
