import crypto from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import mongoose from "mongoose";

import { Customer } from "../models/customer.model";
import { Organization, type IOrganization } from "../models/organization.model";
import { Ticket, type ITicket } from "../models/ticket.model";
import {
  TicketMessage,
  type ITicketMessage,
  type ITicketMessageAttachment,
} from "../models/ticket-message.model";
import { createPresignedViewUrl } from "./storage.service";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const DEFAULT_SUPPORT_MODEL = "moonshotai/kimi-k2.6";

export const SUPPORT_MESSAGE_MAX_LENGTH = 4000;
export const SUPPORT_MESSAGES_PER_SESSION = 50;
const HISTORY_MESSAGE_LIMIT = 30;

export type SupportMessageAttachmentInput = Omit<ITicketMessageAttachment, "url"> & {
  url?: string | null;
};

export type SupportOrganizationBranding = {
  _id: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
};

async function resolveLogoUrl(rawLogo: string | undefined): Promise<string> {
  const value = (rawLogo ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  try {
    return (await createPresignedViewUrl(value)).url;
  } catch {
    return "";
  }
}

export async function getSupportOrganization(
  organizationId: string
): Promise<SupportOrganizationBranding | null> {
  if (!mongoose.Types.ObjectId.isValid(organizationId)) return null;

  const organization = await Organization.findOne({
    _id: organizationId,
    status: "active",
  })
    .select("name logoUrl preferences.primaryColor")
    .lean();
  if (!organization) return null;

  return serializeBranding(organization);
}

async function serializeBranding(
  organization: Pick<IOrganization, "name" | "logoUrl" | "preferences"> & {
    _id: mongoose.Types.ObjectId;
  }
): Promise<SupportOrganizationBranding> {
  return {
    _id: String(organization._id),
    name: organization.name,
    logoUrl: await resolveLogoUrl(organization.logoUrl),
    primaryColor: organization.preferences?.primaryColor ?? "#f5b400",
  };
}

async function nextTicketNumber(
  organizationId: mongoose.Types.ObjectId
): Promise<number> {
  const latest = await Ticket.findOne({ organizationId })
    .sort({ ticketNumber: -1 })
    .select("ticketNumber")
    .lean();
  return (latest?.ticketNumber ?? 0) + 1;
}

export async function createSupportSession(
  organization: SupportOrganizationBranding,
  requester: { name: string; email: string },
  options: { initialIssue?: string; emailTranscriptRequested?: boolean } = {}
): Promise<ITicket> {
  const organizationId = new mongoose.Types.ObjectId(organization._id);
  const sessionToken = crypto.randomBytes(24).toString("base64url");
  const initialIssue = String(options.initialIssue ?? "").trim().slice(0, 2000);
  const exactCustomers = await Customer.find({
    organizationId,
    email: requester.email,
    isArchived: { $ne: true },
  })
    .select("_id")
    .limit(2)
    .lean();
  const exactCustomer = exactCustomers.length === 1 ? exactCustomers[0] : null;
  const customerId = exactCustomer?._id ?? null;

  let ticket: ITicket | null = null;
  // ticketNumber is assigned optimistically; retry on the rare concurrent clash.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      ticket = await Ticket.create({
        organizationId,
        ticketNumber: await nextTicketNumber(organizationId),
        customerId,
        subject: initialIssue ? initialIssue.slice(0, 80) : "",
        initialIssue,
        channel: "chat",
        requester,
        sessionToken,
        emailTranscriptRequested: Boolean(options.emailTranscriptRequested),
        lastMessageAt: new Date(),
        lastVisitorMessageAt: initialIssue ? new Date() : null,
      });
      break;
    } catch (err: any) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
  if (!ticket) throw new Error("Failed to create support session");

  if (initialIssue) {
    await TicketMessage.create({
      ticketId: ticket._id,
      organizationId,
      authorType: "visitor",
      bodyText: initialIssue,
    });
  }

  const firstName = requester.name.split(/\s+/)[0] || requester.name;
  await TicketMessage.create({
    ticketId: ticket._id,
    organizationId,
    authorType: "bot",
    bodyText: `Hi ${firstName}! Welcome to ${organization.name} support. How can we help you today?`,
  });

  return ticket;
}

export async function findSessionTicket(sessionToken: string): Promise<ITicket | null> {
  const token = sessionToken.trim();
  if (!token) return null;
  return Ticket.findOne({ sessionToken: token, channel: "chat" });
}

export async function listSessionMessages(ticket: ITicket) {
  const messages = await TicketMessage.find({
    ticketId: ticket._id,
    isInternal: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .lean();

  return Promise.all(
    messages.map(async (message) => ({
      id: String(message._id),
      authorType: message.authorType,
      bodyText: message.bodyText,
      attachments: await Promise.all(
        (message.attachments ?? []).map(async (attachment) => ({
          key: attachment.key,
          originalName: attachment.originalName,
          contentType: attachment.contentType,
          size: attachment.size,
          url: await resolveAttachmentUrl(attachment),
        }))
      ),
      createdAt: message.createdAt,
    }))
  );
}

export async function countSessionMessages(ticket: ITicket): Promise<number> {
  return TicketMessage.countDocuments({ ticketId: ticket._id, isInternal: { $ne: true } });
}

function buildSystemPrompt(organizationName: string, requesterName: string): string {
  return `You are the customer support assistant for ${organizationName}.
You are chatting with ${requesterName}.

Guidelines:
- Be friendly, concise, and helpful. Answer in plain text without markdown headings.
- You do not have access to order, billing, or account systems. Never invent order statuses, prices, policies, or delivery dates.
- If you cannot resolve something or the customer asks for a human, tell them their conversation has been recorded and the ${organizationName} team will follow up over email at the address they provided.
- Stay on the topic of ${organizationName} and its products or services. Politely decline unrelated requests.`;
}

async function resolveAttachmentUrl(attachment: ITicketMessageAttachment): Promise<string | null> {
  try {
    return (await createPresignedViewUrl(attachment.key)).url;
  } catch {
    return null;
  }
}

async function modelMessagesForTicket(ticket: ITicket): Promise<ModelMessage[]> {
  const history = await TicketMessage.find({
    ticketId: ticket._id,
    authorType: { $in: ["visitor", "bot"] },
  })
    .sort({ createdAt: -1 })
    .limit(HISTORY_MESSAGE_LIMIT)
    .lean();

  return history
    .reverse()
    .map((message) => ({
      role: message.authorType === "visitor" ? ("user" as const) : ("assistant" as const),
      content: [
        message.bodyText,
        ...(message.attachments ?? []).map(
          (attachment) => `[Attachment: ${attachment.originalName} (${attachment.contentType})]`
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    }));
}

export async function streamSupportReply(ticket: ITicket): Promise<globalThis.Response> {
  const result = streamText({
    model: openrouter(process.env.SUPPORT_CHAT_MODEL ?? DEFAULT_SUPPORT_MODEL),
    system: buildSystemPrompt(
      (await Organization.findById(ticket.organizationId).select("name").lean())?.name ??
        "this business",
      ticket.requester.name
    ),
    messages: await modelMessagesForTicket(ticket),
    onFinish: async ({ text }) => {
      const reply = text.trim();
      if (!reply) return;
      try {
        await TicketMessage.create({
          ticketId: ticket._id,
          organizationId: ticket.organizationId,
          authorType: "bot",
          bodyText: reply,
        });
        await Ticket.updateOne({ _id: ticket._id }, { lastMessageAt: new Date() });
      } catch (err) {
        console.error(`Failed to persist bot reply for ticket ${ticket._id}:`, err);
      }
    },
  });

  return result.toTextStreamResponse();
}

export async function generateSupportBotMessage(ticket: ITicket): Promise<ITicketMessage | null> {
  const result = await generateText({
    model: openrouter(process.env.SUPPORT_CHAT_MODEL ?? DEFAULT_SUPPORT_MODEL),
    system: buildSystemPrompt(
      (await Organization.findById(ticket.organizationId).select("name").lean())?.name ??
        "this business",
      ticket.requester.name
    ),
    messages: await modelMessagesForTicket(ticket),
  });

  const reply = result.text.trim();
  if (!reply) return null;

  const message = await TicketMessage.create({
    ticketId: ticket._id,
    organizationId: ticket.organizationId,
    authorType: "bot",
    bodyText: reply,
  });
  await Ticket.updateOne({ _id: ticket._id }, { lastMessageAt: new Date() });
  return message;
}

export async function appendVisitorMessage(
  ticket: ITicket,
  bodyText: string,
  attachments: SupportMessageAttachmentInput[] = []
): Promise<ITicketMessage> {
  const message = await TicketMessage.create({
    ticketId: ticket._id,
    organizationId: ticket.organizationId,
    authorType: "visitor",
    bodyText,
    attachments: attachments.map((attachment) => ({ ...attachment, url: attachment.url ?? null })),
  });

  const now = new Date();
  const update: Record<string, unknown> = {
    lastMessageAt: now,
    lastVisitorMessageAt: now,
  };
  if (ticket.status === "resolved" || ticket.status === "closed") {
    update.status = "open";
    update.resolvedAt = null;
  }
  if (!ticket.subject) {
    update.subject = bodyText.slice(0, 80);
  }
  await Ticket.updateOne({ _id: ticket._id }, update);
  return message;
}
