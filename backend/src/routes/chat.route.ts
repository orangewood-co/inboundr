import { Router, type Request, type Response as ExpressResponse } from "express";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage,
} from "ai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { Readable } from "node:stream";
import mongoose from "mongoose";

import { ChatMessage } from "../models/chat-message.model";
import { ChatThread, type ChatThreadStatus } from "../models/chat-thread.model";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const DEFAULT_CHAT_MODEL = "openai/gpt-5.5";
const DEFAULT_TITLE_MODEL = "openai/gpt-5.4-nano";

function userIdFrom(req: Request): string {
  return (req as AuthenticatedRequest).user.id;
}

function threadIdFrom(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id ?? "";
}

function normalizeThreadStatus(value: unknown): ChatThreadStatus | undefined {
  return value === "regular" || value === "archived" ? value : undefined;
}

async function findOwnedThread(threadId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(threadId)) return null;
  return ChatThread.findOne({ _id: threadId, userId });
}

async function pipeWebResponse(webResponse: globalThis.Response, res: ExpressResponse): Promise<void> {
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

router.use(requireAuth);

router.post("/", async (req: Request, res: ExpressResponse) => {
  try {
    const {
      messages,
      system,
      tools,
    }: {
      messages: UIMessage[];
      system?: string;
      tools?: Record<string, unknown>;
    } = req.body;

    const aiTools = frontendTools((tools ?? {}) as Parameters<typeof frontendTools>[0]);
    const result = streamText({
      model: openrouter(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
      system: system ?? "You are a helpful assistant for Inboundr users.",
      messages: await convertToModelMessages(messages ?? [], { tools: aiTools }),
      tools: aiTools,
    });

    await pipeWebResponse(result.toUIMessageStreamResponse(), res);
  } catch (err) {
    console.error("Chat stream failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream chat response" });
    }
  }
});

router.get("/threads", async (req: Request, res: ExpressResponse) => {
  try {
    const status = normalizeThreadStatus(req.query.status) ?? "regular";
    const threads = await ChatThread.find({ userId: userIdFrom(req), status })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    res.json(
      threads.map((thread) => ({
        id: thread._id.toString(),
        title: thread.title ?? undefined,
        status: thread.status,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }))
    );
  } catch (err) {
    console.error("Failed to list chat threads:", err);
    res.status(500).json({ error: "Failed to list chat threads" });
  }
});

router.post("/threads", async (req: Request, res: ExpressResponse) => {
  try {
    const thread = await ChatThread.create({
      userId: userIdFrom(req),
      title: null,
      status: "regular",
    });
    res.status(201).json({ id: thread._id.toString() });
  } catch (err) {
    console.error("Failed to create chat thread:", err);
    res.status(500).json({ error: "Failed to create chat thread" });
  }
});

router.get("/threads/:id", async (req: Request, res: ExpressResponse) => {
  try {
    const thread = await findOwnedThread(threadIdFrom(req), userIdFrom(req));
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.json({
      id: thread._id.toString(),
      title: thread.title ?? undefined,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    });
  } catch (err) {
    console.error("Failed to fetch chat thread:", err);
    res.status(500).json({ error: "Failed to fetch chat thread" });
  }
});

router.patch("/threads/:id", async (req: Request, res: ExpressResponse) => {
  try {
    const userId = userIdFrom(req);
    const threadId = threadIdFrom(req);
    const patch: { title?: string | null; status?: ChatThreadStatus } = {};
    if ("title" in req.body) {
      const title = String(req.body.title ?? "").trim();
      patch.title = title || null;
    }
    const status = normalizeThreadStatus(req.body.status);
    if (status) patch.status = status;

    const thread = await ChatThread.findOneAndUpdate(
      { _id: threadId, userId },
      { ...patch, updatedAt: new Date() },
      { new: true }
    );
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    console.error("Failed to update chat thread:", err);
    res.status(500).json({ error: "Failed to update chat thread" });
  }
});

router.delete("/threads/:id", async (req: Request, res: ExpressResponse) => {
  try {
    const userId = userIdFrom(req);
    const thread = await ChatThread.findOneAndDelete({ _id: threadIdFrom(req), userId });
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    await ChatMessage.deleteMany({ threadId: thread._id, userId });
    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete chat thread:", err);
    res.status(500).json({ error: "Failed to delete chat thread" });
  }
});

router.post("/threads/:id/title", async (req: Request, res: ExpressResponse) => {
  try {
    const thread = await findOwnedThread(threadIdFrom(req), userIdFrom(req));
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const result = await generateText({
      model: openrouter(process.env.CHAT_TITLE_MODEL ?? DEFAULT_TITLE_MODEL),
      system: "Generate a concise title for this chat. Reply with only the title.",
      prompt: JSON.stringify(req.body.messages ?? []).slice(0, 6000),
    });
    const title = result.text.trim().replace(/^["'`]+|["'`.]+$/g, "").slice(0, 80);
    thread.title = title || "New chat";
    await thread.save();
    res.json({ title: thread.title });
  } catch (err) {
    console.error("Failed to generate chat title:", err);
    res.status(500).json({ error: "Failed to generate chat title" });
  }
});

router.get("/threads/:id/messages", async (req: Request, res: ExpressResponse) => {
  try {
    const userId = userIdFrom(req);
    const thread = await findOwnedThread(threadIdFrom(req), userId);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const messages = await ChatMessage.find({ threadId: thread._id, userId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      messages.map((message) => ({
        id: message.messageId,
        parent_id: message.parentId,
        format: message.format,
        content: message.content,
      }))
    );
  } catch (err) {
    console.error("Failed to list chat messages:", err);
    res.status(500).json({ error: "Failed to list chat messages" });
  }
});

router.post("/threads/:id/messages", async (req: Request, res: ExpressResponse) => {
  try {
    const userId = userIdFrom(req);
    const thread = await findOwnedThread(threadIdFrom(req), userId);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const body = req.body as {
      id?: string;
      parent_id?: string | null;
      format?: string;
      content?: Record<string, unknown>;
    };

    if (!body.id || !body.format || !body.content) {
      res.status(400).json({ error: "Invalid message payload" });
      return;
    }

    await ChatMessage.findOneAndUpdate(
      { threadId: thread._id, messageId: body.id },
      {
        threadId: thread._id,
        userId,
        messageId: body.id,
        parentId: body.parent_id ?? null,
        format: body.format,
        content: body.content,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    thread.updatedAt = new Date();
    await thread.save();
    res.status(204).end();
  } catch (err) {
    console.error("Failed to append chat message:", err);
    res.status(500).json({ error: "Failed to append chat message" });
  }
});

export default router;
