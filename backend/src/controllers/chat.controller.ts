import type { Request, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createChatStreamResponse,
  createChatThread as createChatThreadRecord,
  deleteChatThread as deleteChatThreadRecord,
  generateChatThreadTitle as generateChatThreadTitleRecord,
  getChatThread as getChatThreadRecord,
  listChatMessages as listChatMessageRecords,
  listChatThreads as listChatThreadRecords,
  normalizeThreadStatus,
  saveChatMessage as saveChatMessageRecord,
  updateChatThread as updateChatThreadRecord,
  type ChatMessageInput,
  type ChatStreamInput,
  type ChatThreadPatch,
} from "../services/chat.service";

function userIdFrom(req: Request): string {
  return (req as AuthenticatedRequest).user.id;
}

function threadIdFrom(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id ?? "";
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

export async function streamChat(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const webResponse = await createChatStreamResponse(req.body as ChatStreamInput);
    await pipeWebResponse(webResponse, res);
  } catch (err) {
    console.error("Chat stream failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream chat response" });
    }
  }
}

export async function listChatThreads(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const status = normalizeThreadStatus(req.query.status) ?? "regular";
    const threads = await listChatThreadRecords(userIdFrom(req), status);

    res.json(threads);
  } catch (err) {
    console.error("Failed to list chat threads:", err);
    res.status(500).json({ error: "Failed to list chat threads" });
  }
}

export async function createChatThread(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const thread = await createChatThreadRecord(userIdFrom(req));
    res.status(201).json(thread);
  } catch (err) {
    console.error("Failed to create chat thread:", err);
    res.status(500).json({ error: "Failed to create chat thread" });
  }
}

export async function getChatThread(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const thread = await getChatThreadRecord(threadIdFrom(req), userIdFrom(req));
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.json(thread);
  } catch (err) {
    console.error("Failed to fetch chat thread:", err);
    res.status(500).json({ error: "Failed to fetch chat thread" });
  }
}

export async function updateChatThread(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const patch: ChatThreadPatch = {};
    if ("title" in req.body) {
      const title = String(req.body.title ?? "").trim();
      patch.title = title || null;
    }
    const status = normalizeThreadStatus(req.body.status);
    if (status) patch.status = status;

    const updated = await updateChatThreadRecord(threadIdFrom(req), userIdFrom(req), patch);
    if (!updated) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("Failed to update chat thread:", err);
    res.status(500).json({ error: "Failed to update chat thread" });
  }
}

export async function deleteChatThread(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const deleted = await deleteChatThreadRecord(threadIdFrom(req), userIdFrom(req));
    if (!deleted) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete chat thread:", err);
    res.status(500).json({ error: "Failed to delete chat thread" });
  }
}

export async function generateChatThreadTitle(
  req: Request,
  res: ExpressResponse
): Promise<void> {
  try {
    const title = await generateChatThreadTitleRecord(
      threadIdFrom(req),
      userIdFrom(req),
      req.body.messages
    );
    if (!title) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.json({ title });
  } catch (err) {
    console.error("Failed to generate chat title:", err);
    res.status(500).json({ error: "Failed to generate chat title" });
  }
}

export async function listChatMessages(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const messages = await listChatMessageRecords(threadIdFrom(req), userIdFrom(req));
    if (!messages) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.json(messages);
  } catch (err) {
    console.error("Failed to list chat messages:", err);
    res.status(500).json({ error: "Failed to list chat messages" });
  }
}

export async function saveChatMessage(req: Request, res: ExpressResponse): Promise<void> {
  try {
    const result = await saveChatMessageRecord(
      threadIdFrom(req),
      userIdFrom(req),
      req.body as ChatMessageInput
    );
    if (result === "not-found") {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (result === "invalid") {
      res.status(400).json({ error: "Invalid message payload" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("Failed to append chat message:", err);
    res.status(500).json({ error: "Failed to append chat message" });
  }
}
