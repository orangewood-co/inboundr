import type { IncomingMessage, Server as HttpServer } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { WebSocket, WebSocketServer } from "ws";

import { auth } from "../lib/auth";
import { getOrganizationContextForUser } from "./organization.service";
import type { SerializedNotification } from "./notification.service";

type NotificationSocketContext = {
  organizationId: string;
  userId: string;
};

type NotificationSocket = WebSocket & {
  context?: NotificationSocketContext;
};

let notificationWss: WebSocketServer | null = null;

function send(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(
  predicate: (context: NotificationSocketContext) => boolean,
  payload: Record<string, unknown>
): void {
  if (!notificationWss) return;
  for (const client of notificationWss.clients as Set<NotificationSocket>) {
    if (client.context && predicate(client.context)) {
      send(client, payload);
    }
  }
}

async function authenticateSocket(req: IncomingMessage): Promise<NotificationSocketContext | null> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "", `http://${host}`);
  if (url.pathname !== "/api/v1/notifications/ws") return null;

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session?.user) return null;

  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const context = await getOrganizationContextForUser(session.user, organizationId);
  if (context.organization.status === "suspended") return null;

  return {
    organizationId: String(context.organization._id),
    userId: session.user.id,
  };
}

function parseJson(message: WebSocket.RawData): Record<string, unknown> | null {
  try {
    return JSON.parse(message.toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function handleSocketMessage(ws: NotificationSocket, raw: WebSocket.RawData): void {
  const payload = parseJson(raw);
  if (!payload) {
    send(ws, { type: "error", error: "Invalid message payload" });
    return;
  }

  if (payload.type === "ping") {
    send(ws, { type: "pong" });
    return;
  }

  send(ws, { type: "error", error: "Unknown message type" });
}

export function broadcastNotificationCreated(notification: SerializedNotification): void {
  broadcast(
    (context) =>
      context.organizationId === notification.organizationId &&
      context.userId === notification.recipientUserId,
    { type: "notification.created", notification }
  );
}

export function broadcastNotificationUpdated(notification: SerializedNotification): void {
  broadcast(
    (context) =>
      context.organizationId === notification.organizationId &&
      context.userId === notification.recipientUserId,
    { type: "notification.updated", notification }
  );
}

export function broadcastNotificationReadAll(payload: {
  organizationId: string;
  recipientUserId: string;
  readAt: string;
}): void {
  broadcast(
    (context) =>
      context.organizationId === payload.organizationId &&
      context.userId === payload.recipientUserId,
    { type: "notifications.read_all", readAt: payload.readAt }
  );
}

export function attachNotificationWebSocketServer(server: HttpServer): void {
  notificationWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "", `http://${host}`);
    if (url.pathname !== "/api/v1/notifications/ws") return;

    notificationWss?.handleUpgrade(req, socket, head, (ws) => {
      notificationWss?.emit("connection", ws, req);
    });
  });

  notificationWss.on("connection", async (socket: NotificationSocket, req) => {
    try {
      socket.context = await authenticateSocket(req) ?? undefined;
      if (!socket.context) {
        socket.close(1008, "Unauthorized");
        return;
      }

      send(socket, {
        type: "connected",
        organizationId: socket.context.organizationId,
        userId: socket.context.userId,
      });

      socket.on("message", (message) => handleSocketMessage(socket, message));
    } catch (err) {
      console.error("Notification WebSocket connection failed:", err);
      socket.close(1011, "Connection failed");
    }
  });

  console.log("Notification WebSocket server attached at /api/v1/notifications/ws");
}
