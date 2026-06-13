import type { Request, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";

import {
  appendVisitorMessage,
  countSessionMessages,
  createSupportSession,
  findSessionTicket,
  getSupportOrganization,
  listSessionMessages,
  streamSupportReply,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_MESSAGES_PER_SESSION,
} from "../services/support-chat.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lightweight in-memory rate limiter. Good enough for a single-process API;
// swap for a shared store if the backend is ever scaled horizontally.
const rateBuckets = new Map<string, number[]>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) ?? []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateBuckets) {
    if (hits.every((at) => now - at > 15 * 60 * 1000)) rateBuckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function pipeWebResponse(
  webResponse: globalThis.Response,
  res: ExpressResponse
): Promise<void> {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!webResponse.body) {
    res.end();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const nodeStream = Readable.fromWeb(webResponse.body as never);
    nodeStream.on("error", reject);
    res.on("finish", resolve);
    res.on("error", reject);
    nodeStream.pipe(res);
  });
}

export async function getSupportWorkspace(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const organization = await getSupportOrganization(String(req.params.organizationId ?? ""));
    if (!organization) {
      res.status(404).json({ error: "Support is not available for this workspace" });
      return;
    }
    res.json({ organization });
  } catch (err) {
    console.error("Failed to load support workspace:", err);
    res.status(500).json({ error: "Failed to load support workspace" });
  }
}

export async function startSupportSession(req: Request, res: ExpressResponse): Promise<void> {
  try {
    if (isRateLimited(`session:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: "Too many chats started. Please try again later." });
      return;
    }

    const organizationId = String(req.body?.organizationId ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();

    if (!name || name.length > 120) {
      res.status(400).json({ error: "Please enter your name" });
      return;
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      res.status(400).json({ error: "Please enter a valid email address" });
      return;
    }

    const organization = await getSupportOrganization(organizationId);
    if (!organization) {
      res.status(404).json({ error: "Support is not available for this workspace" });
      return;
    }

    const ticket = await createSupportSession(organization, { name, email });
    res.status(201).json({
      sessionToken: ticket.sessionToken,
      organization,
      requester: ticket.requester,
      messages: await listSessionMessages(ticket),
    });
  } catch (err) {
    console.error("Failed to start support session:", err);
    res.status(500).json({ error: "Failed to start support chat" });
  }
}

export async function getSupportSession(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const ticket = await findSessionTicket(String(req.params.token ?? ""));
    if (!ticket) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }

    const organization = await getSupportOrganization(String(ticket.organizationId));
    if (!organization) {
      res.status(404).json({ error: "Support is not available for this workspace" });
      return;
    }

    res.json({
      sessionToken: ticket.sessionToken,
      organization,
      requester: ticket.requester,
      messages: await listSessionMessages(ticket),
    });
  } catch (err) {
    console.error("Failed to load support session:", err);
    res.status(500).json({ error: "Failed to load support chat" });
  }
}

export async function postSupportSessionMessage(
  req: Request,
  res: ExpressResponse
): Promise<void> {
  try {
    if (isRateLimited(`message:${clientIp(req)}`, 15, 60 * 1000)) {
      res.status(429).json({ error: "You are sending messages too quickly. Please slow down." });
      return;
    }

    const ticket = await findSessionTicket(String(req.params.token ?? ""));
    if (!ticket) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }

    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    if (text.length > SUPPORT_MESSAGE_MAX_LENGTH) {
      res.status(400).json({ error: "Message is too long" });
      return;
    }

    if ((await countSessionMessages(ticket)) >= SUPPORT_MESSAGES_PER_SESSION) {
      res.status(429).json({
        error:
          "This chat has reached its message limit. The team will follow up with you over email.",
      });
      return;
    }

    await appendVisitorMessage(ticket, text);
    const webResponse = await streamSupportReply(ticket);
    await pipeWebResponse(webResponse, res);
  } catch (err) {
    console.error("Failed to handle support message:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
}
