import mongoose from "mongoose";

import { Customer } from "../models/customer.model";
import { Ticket, type ITicket, type TicketPriority } from "../models/ticket.model";
import { TicketMessage } from "../models/ticket-message.model";
import { CallSession } from "../models/call-session.model";
import { loadOrgPromptContext } from "./support-chat.service";

export interface VoiceToolContext {
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  callSessionId: mongoose.Types.ObjectId;
  callerNumber: string;
  callerName: string;
}

/**
 * Function tools exposed to the realtime voice agent. The shapes follow the
 * Realtime API `tools` config (`type: "function"`).
 */
export const VOICE_AGENT_TOOLS = [
  {
    type: "function" as const,
    name: "lookup_knowledge_base",
    description:
      "Search the organization's support knowledge base for information to answer the caller's question. Always call this before answering factual questions about the company, its products, policies, or services.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A concise search query describing what the caller is asking about.",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function" as const,
    name: "create_support_ticket",
    description:
      "Create a support ticket when the caller has an issue, request, or question that needs follow-up from the support team. Call this once you have understood the caller's problem.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "A short one-line summary of the caller's issue.",
        },
        issue: {
          type: "string",
          description: "A detailed description of the caller's issue or request in their own words.",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
          description: "Urgency of the issue. Use 'urgent' only for outages or time-critical problems.",
        },
        caller_name: {
          type: "string",
          description: "The caller's name, if they provided it.",
        },
        caller_email: {
          type: "string",
          description: "The caller's email address, if they provided one for follow-up.",
        },
      },
      required: ["subject", "issue"],
    },
  },
] as const;

function normalizePriority(value: unknown): TicketPriority {
  return value === "low" || value === "high" || value === "urgent" ? value : "normal";
}

async function nextTicketNumber(organizationId: mongoose.Types.ObjectId): Promise<number> {
  const latest = await Ticket.findOne({ organizationId })
    .sort({ ticketNumber: -1 })
    .select("ticketNumber")
    .lean();
  return (latest?.ticketNumber ?? 0) + 1;
}

async function findCustomerId(
  organizationId: mongoose.Types.ObjectId,
  email: string,
  phoneNumber: string
): Promise<mongoose.Types.ObjectId | null> {
  if (email) {
    const byEmail = await Customer.find({
      organizationId,
      email,
      isArchived: { $ne: true },
    })
      .select("_id")
      .limit(2)
      .lean();
    if (byEmail.length === 1 && byEmail[0]) return byEmail[0]._id;
  }
  if (phoneNumber) {
    const byPhone = await Customer.find({
      organizationId,
      contactNumber: phoneNumber,
      isArchived: { $ne: true },
    })
      .select("_id")
      .limit(2)
      .lean();
    if (byPhone.length === 1 && byPhone[0]) return byPhone[0]._id;
  }
  return null;
}

async function lookupKnowledgeBase(
  ctx: VoiceToolContext,
  query: string
): Promise<Record<string, unknown>> {
  const context = await loadOrgPromptContext(ctx.organizationId, query);
  const articles = context.articles
    .filter((article) => article.body.trim().length > 0)
    .map((article) => ({
      title: article.title,
      content: article.body,
    }));

  if (articles.length === 0) {
    return {
      found: false,
      message:
        "No matching knowledge base articles were found. Let the caller know the team will follow up if you cannot answer.",
    };
  }
  return { found: true, articles };
}

/**
 * Creates (or returns the existing) phone-channel ticket for this call. The
 * transcript is appended later during call finalization.
 */
export async function ensureCallTicket(
  ctx: VoiceToolContext,
  options: {
    subject?: string;
    issue?: string;
    priority?: TicketPriority;
    callerName?: string;
    callerEmail?: string;
  } = {}
): Promise<ITicket> {
  const callSession = await CallSession.findById(ctx.callSessionId);
  if (callSession?.ticketId) {
    const existing = await Ticket.findById(callSession.ticketId);
    if (existing) return existing;
  }

  const name = String(options.callerName ?? ctx.callerName ?? "").trim() || ctx.callerNumber || "Phone caller";
  const email = String(options.callerEmail ?? "").trim().toLowerCase();
  const phoneNumber = ctx.callerNumber;
  const customerId = await findCustomerId(ctx.organizationId, email, phoneNumber);
  const initialIssue = String(options.issue ?? "").trim().slice(0, 2000);
  const subject = String(options.subject ?? "").trim().slice(0, 80) || (initialIssue ? initialIssue.slice(0, 80) : "Phone call");

  let ticket: ITicket | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      ticket = await Ticket.create({
        organizationId: ctx.organizationId,
        ticketNumber: await nextTicketNumber(ctx.organizationId),
        customerId,
        subject,
        initialIssue,
        priority: options.priority ?? "normal",
        channel: "phone",
        requester: { name, email, phoneNumber },
        sessionToken: null,
        botEnabled: false,
        aiMode: "paused",
        lastMessageAt: new Date(),
      });
      break;
    } catch (err: any) {
      if (err.code !== 11000 || attempt === 2) throw err;
    }
  }
  if (!ticket) throw new Error("Failed to create phone support ticket");

  if (callSession) {
    callSession.ticketId = ticket._id as mongoose.Types.ObjectId;
    await callSession.save();
  }
  return ticket;
}

async function createSupportTicketTool(
  ctx: VoiceToolContext,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const ticket = await ensureCallTicket(ctx, {
    subject: String(args.subject ?? ""),
    issue: String(args.issue ?? ""),
    priority: normalizePriority(args.priority),
    callerName: typeof args.caller_name === "string" ? args.caller_name : undefined,
    callerEmail: typeof args.caller_email === "string" ? args.caller_email : undefined,
  });

  // Persist the structured issue immediately so the ticket is useful even if the
  // call drops before finalization runs.
  const issue = String(args.issue ?? "").trim();
  if (issue) {
    await TicketMessage.create({
      ticketId: ticket._id,
      organizationId: ctx.organizationId,
      authorType: "system",
      bodyText: `Issue captured during call: ${issue}`,
      isInternal: true,
    });
  }

  return {
    success: true,
    ticket_number: ticket.ticketNumber,
    message: `A support ticket #${ticket.ticketNumber} has been created. Confirm this to the caller and let them know the team will follow up.`,
  };
}

export async function executeVoiceTool(
  name: string,
  args: Record<string, unknown>,
  ctx: VoiceToolContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case "lookup_knowledge_base":
      return lookupKnowledgeBase(ctx, String(args.query ?? ""));
    case "create_support_ticket":
      return createSupportTicketTool(ctx, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
