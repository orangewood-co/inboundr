import type { IncomingMessage, Server as HttpServer } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import mongoose from "mongoose";
import { WebSocket, WebSocketServer } from "ws";

import { auth } from "../lib/auth";
import { Ticket } from "../models/ticket.model";
import { TicketMessage, type ITicketMessageAttachment } from "../models/ticket-message.model";
import { getOrganizationContextForUser } from "./organization.service";
import {
  appendVisitorMessage,
  countSessionMessages,
  findSessionTicket,
  generateSupportBotMessage,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_MESSAGES_PER_SESSION,
  type SupportMessageAttachmentInput,
} from "./support-chat.service";
import { serializeTicket, serializeTicketMessage } from "./ticket.service";
import { keyBelongsToPrefix } from "./storage.service";

type SupportSocketKind = "agent" | "visitor";

type SupportSocketContext =
  | {
      kind: "agent";
      userId: string;
      organizationId: string;
      ticketIds: Set<string>;
    }
  | {
      kind: "visitor";
      organizationId: string;
      ticketId: string;
      sessionToken: string;
      ticketIds: Set<string>;
    };

type SupportSocket = WebSocket & {
  context?: SupportSocketContext;
};

let supportWss: WebSocketServer | null = null;

function send(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(predicate: (context: SupportSocketContext) => boolean, payload: Record<string, unknown>): void {
  if (!supportWss) return;
  for (const client of supportWss.clients as Set<SupportSocket>) {
    if (client.context && predicate(client.context)) {
      send(client, payload);
    }
  }
}

function ticketTopic(ticketId: string, context: SupportSocketContext): boolean {
  return context.ticketIds.has(ticketId);
}

export function broadcastTicketUpdate(organizationId: string, ticket: unknown): void {
  broadcast(
    (context) => context.organizationId === organizationId,
    { type: "ticket.updated", ticket }
  );
}

async function broadcastTicketById(ticketId: string): Promise<void> {
  const ticket = await Ticket.findById(ticketId).lean();
  if (!ticket) return;
  broadcastTicketUpdate(String(ticket.organizationId), serializeTicket(ticket));
}

export async function broadcastMessageCreated(
  message: unknown & { ticketId?: unknown; organizationId?: unknown }
) {
  const serialized = await serializeTicketMessage(message);
  const ticketId = String(message.ticketId ?? serialized.ticketId);
  const organizationId = String(message.organizationId ?? "");
  broadcast(
    (context) =>
      context.organizationId === organizationId &&
      (context.kind === "agent" || ticketTopic(ticketId, context)),
    { type: "message.created", message: serialized }
  );
}

function parseJson(message: WebSocket.RawData): Record<string, unknown> | null {
  try {
    return JSON.parse(message.toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function authenticateAgent(req: IncomingMessage, url: URL): Promise<SupportSocketContext | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user) return null;

  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const context = await getOrganizationContextForUser(session.user, organizationId);
  return {
    kind: "agent",
    userId: session.user.id,
    organizationId: String(context.organization._id),
    ticketIds: new Set(),
  };
}

async function authenticateVisitor(url: URL): Promise<SupportSocketContext | null> {
  const sessionToken = (url.searchParams.get("sessionToken") ?? "").trim();
  const ticket = await findSessionTicket(sessionToken);
  if (!ticket) return null;

  return {
    kind: "visitor",
    organizationId: String(ticket.organizationId),
    ticketId: String(ticket._id),
    sessionToken,
    ticketIds: new Set([String(ticket._id)]),
  };
}

async function authenticateSocket(req: IncomingMessage): Promise<SupportSocketContext | null> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "", `http://${host}`);
  if (url.pathname !== "/api/v1/support/ws") return null;

  const mode = url.searchParams.get("mode");
  if (mode === "agent") return authenticateAgent(req, url);
  if (mode === "visitor") return authenticateVisitor(url);
  return null;
}

function sanitizeText(value: unknown): string {
  return String(value ?? "").trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
}

function normalizeAttachments(
  value: unknown,
  organizationId: string,
  ticketId: string,
  source: "agent" | "visitor"
): SupportMessageAttachmentInput[] {
  const attachments = Array.isArray(value) ? value.slice(0, 5) : [];
  return attachments
    .map((attachment) => {
      const input = attachment as Partial<ITicketMessageAttachment>;
      const key = String(input.key ?? "").trim();
      const originalName = String(input.originalName ?? "").trim();
      const contentType = String(input.contentType ?? "").trim();
      const size = Number(input.size ?? 0);
      if (!key || !originalName || !contentType || !Number.isFinite(size) || size <= 0) {
        return null;
      }
      const allowed = source === "visitor"
        ? keyBelongsToPrefix(key, ["support", organizationId, ticketId, "visitor"])
        : keyBelongsToPrefix(key, ["support", organizationId]);
      if (!allowed) return null;
      return {
        key,
        originalName,
        contentType,
        size,
        url: typeof input.url === "string" ? input.url : null,
      };
    })
    .filter(Boolean) as SupportMessageAttachmentInput[];
}

async function handleSubscribeTicket(ws: SupportSocket, payload: Record<string, unknown>) {
  if (!ws.context || ws.context.kind !== "agent") return;
  const ticketId = String(payload.ticketId ?? "");
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return;
  const exists = await Ticket.exists({
    _id: ticketId,
    organizationId: ws.context.organizationId,
  });
  if (!exists) {
    send(ws, { type: "error", error: "Ticket not found" });
    return;
  }
  ws.context.ticketIds.add(ticketId);
  send(ws, { type: "ticket.subscribed", ticketId });
}

async function handleAgentMessage(ws: SupportSocket, payload: Record<string, unknown>) {
  if (!ws.context || ws.context.kind !== "agent") return;
  const ticketId = String(payload.ticketId ?? "");
  const bodyText = sanitizeText(payload.text);
  const attachments = normalizeAttachments(
    payload.attachments,
    ws.context.organizationId,
    ticketId,
    "agent"
  );
  if (!bodyText && attachments.length === 0) {
    send(ws, { type: "error", error: "Message cannot be empty" });
    return;
  }

  const ticket = await Ticket.findOne({
    _id: ticketId,
    organizationId: ws.context.organizationId,
  });
  if (!ticket) {
    send(ws, { type: "error", error: "Ticket not found" });
    return;
  }

  const message = await TicketMessage.create({
    ticketId: ticket._id,
    organizationId: ticket.organizationId,
    authorType: "agent",
    authorUserId: ws.context.userId,
    bodyText,
    attachments,
  });

  const now = new Date();
  await Ticket.updateOne(
    { _id: ticket._id },
    {
      botEnabled: false,
      status: ticket.status === "closed" ? "open" : ticket.status,
      lastMessageAt: now,
      lastAgentMessageAt: now,
    }
  );

  await broadcastMessageCreated(message);
  await broadcastTicketById(String(ticket._id));
}

async function handleVisitorMessage(ws: SupportSocket, payload: Record<string, unknown>) {
  if (!ws.context || ws.context.kind !== "visitor") return;
  const ticket = await findSessionTicket(ws.context.sessionToken);
  if (!ticket) {
    send(ws, { type: "error", error: "Chat session not found" });
    return;
  }

  const bodyText = sanitizeText(payload.text);
  const attachments = normalizeAttachments(
    payload.attachments,
    String(ticket.organizationId),
    String(ticket._id),
    "visitor"
  );
  if (!bodyText && attachments.length === 0) {
    send(ws, { type: "error", error: "Message cannot be empty" });
    return;
  }
  if ((await countSessionMessages(ticket)) >= SUPPORT_MESSAGES_PER_SESSION) {
    send(ws, {
      type: "error",
      error: "This chat has reached its message limit. The team will follow up with you over email.",
    });
    return;
  }

  const visitorMessage = await appendVisitorMessage(ticket, bodyText, attachments);
  await broadcastMessageCreated(visitorMessage);
  await broadcastTicketById(String(ticket._id));

  const freshTicket = await findSessionTicket(ws.context.sessionToken);
  if (!freshTicket?.botEnabled) return;

  try {
    const botMessage = await generateSupportBotMessage(freshTicket);
    if (botMessage) {
      await broadcastMessageCreated(botMessage);
      await broadcastTicketById(String(freshTicket._id));
    }
  } catch (err) {
    console.error(`Failed to generate support bot reply for ticket ${ticket._id}:`, err);
  }
}

async function handleResolve(ws: SupportSocket, payload: Record<string, unknown>, resolved: boolean) {
  if (!ws.context || ws.context.kind !== "agent") return;
  const ticketId = String(payload.ticketId ?? "");
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return;
  const now = new Date();
  const ticket = await Ticket.findOneAndUpdate(
    { _id: ticketId, organizationId: ws.context.organizationId },
    resolved
      ? { status: "resolved", resolvedAt: now, botEnabled: false, lastMessageAt: now }
      : { status: "open", resolvedAt: null, lastMessageAt: now },
    { new: true }
  ).lean();
  if (ticket) broadcastTicketUpdate(ws.context.organizationId, serializeTicket(ticket));
}

async function handleSocketMessage(ws: SupportSocket, raw: WebSocket.RawData) {
  const payload = parseJson(raw);
  if (!payload) {
    send(ws, { type: "error", error: "Invalid message payload" });
    return;
  }

  switch (payload.type) {
    case "subscribe_ticket":
      await handleSubscribeTicket(ws, payload);
      break;
    case "agent_message":
      await handleAgentMessage(ws, payload);
      break;
    case "visitor_message":
      await handleVisitorMessage(ws, payload);
      break;
    case "resolve_ticket":
      await handleResolve(ws, payload, true);
      break;
    case "reopen_ticket":
      await handleResolve(ws, payload, false);
      break;
    case "ping":
      send(ws, { type: "pong" });
      break;
    default:
      send(ws, { type: "error", error: "Unknown message type" });
  }
}

export function attachSupportWebSocketServer(server: HttpServer): void {
  supportWss = new WebSocketServer({ server, path: "/api/v1/support/ws" });

  supportWss.on("connection", async (socket: SupportSocket, req) => {
    try {
      socket.context = await authenticateSocket(req) ?? undefined;
      if (!socket.context) {
        socket.close(1008, "Unauthorized");
        return;
      }
      send(socket, {
        type: "connected",
        mode: socket.context.kind,
        organizationId: socket.context.organizationId,
        ticketId: socket.context.kind === "visitor" ? socket.context.ticketId : null,
      });

      socket.on("message", (message) => {
        void handleSocketMessage(socket, message).catch((err) => {
          console.error("Support WebSocket message failed:", err);
          send(socket, { type: "error", error: "Failed to process message" });
        });
      });
    } catch (err) {
      console.error("Support WebSocket connection failed:", err);
      socket.close(1011, "Connection failed");
    }
  });

  console.log("Support WebSocket server attached at /api/v1/support/ws");
}
