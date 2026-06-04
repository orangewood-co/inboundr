import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage,
} from "ai";
import mongoose from "mongoose";

import { ChatMessage } from "../models/chat-message.model";
import { ChatThread, type ChatThreadStatus } from "../models/chat-thread.model";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const DEFAULT_CHAT_MODEL = "openai/gpt-5.5";
const DEFAULT_TITLE_MODEL = "openai/gpt-5.4-nano";

export type ChatStreamInput = {
  messages?: UIMessage[];
  system?: string;
  tools?: Record<string, unknown>;
};

export type ChatMessageInput = {
  id?: string;
  parent_id?: string | null;
  format?: string;
  content?: Record<string, unknown>;
};

export type ChatThreadPatch = {
  title?: string | null;
  status?: ChatThreadStatus;
};

export function normalizeThreadStatus(value: unknown): ChatThreadStatus | undefined {
  return value === "regular" || value === "archived" ? value : undefined;
}

export async function findOwnedThread(threadId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(threadId)) return null;
  return ChatThread.findOne({ _id: threadId, userId });
}

function serializeThread(thread: {
  _id: mongoose.Types.ObjectId;
  title?: string | null;
  status: ChatThreadStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: thread._id.toString(),
    title: thread.title ?? undefined,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export async function createChatStreamResponse(input: ChatStreamInput): Promise<globalThis.Response> {
  const aiTools = frontendTools((input.tools ?? {}) as Parameters<typeof frontendTools>[0]);
  const result = streamText({
    model: openrouter(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
    system: input.system ?? "You are a helpful assistant for Inboundr users.",
    messages: await convertToModelMessages(input.messages ?? [], { tools: aiTools }),
    tools: aiTools,
  });

  return result.toUIMessageStreamResponse();
}

export async function listChatThreads(userId: string, status: ChatThreadStatus) {
  const threads = await ChatThread.find({ userId, status })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return threads.map(serializeThread);
}

export async function createChatThread(userId: string) {
  const thread = await ChatThread.create({
    userId,
    title: null,
    status: "regular",
  });

  return { id: thread._id.toString() };
}

export async function getChatThread(threadId: string, userId: string) {
  const thread = await findOwnedThread(threadId, userId);
  return thread ? serializeThread(thread) : null;
}

export async function updateChatThread(
  threadId: string,
  userId: string,
  patch: ChatThreadPatch
): Promise<boolean> {
  const thread = await ChatThread.findOneAndUpdate(
    { _id: threadId, userId },
    { ...patch, updatedAt: new Date() },
    { new: true }
  );

  return Boolean(thread);
}

export async function deleteChatThread(threadId: string, userId: string): Promise<boolean> {
  const thread = await ChatThread.findOneAndDelete({ _id: threadId, userId });
  if (!thread) return false;

  await ChatMessage.deleteMany({ threadId: thread._id, userId });
  return true;
}

export async function generateChatThreadTitle(
  threadId: string,
  userId: string,
  messages: unknown
): Promise<string | null> {
  const thread = await findOwnedThread(threadId, userId);
  if (!thread) return null;

  const result = await generateText({
    model: openrouter(process.env.CHAT_TITLE_MODEL ?? DEFAULT_TITLE_MODEL),
    system: "Generate a concise title for this chat. Reply with only the title.",
    prompt: JSON.stringify(messages ?? []).slice(0, 6000),
  });
  const title = result.text.trim().replace(/^["'`]+|["'`.]+$/g, "").slice(0, 80);
  thread.title = title || "New chat";
  await thread.save();

  return thread.title;
}

export async function listChatMessages(threadId: string, userId: string) {
  const thread = await findOwnedThread(threadId, userId);
  if (!thread) return null;

  const messages = await ChatMessage.find({ threadId: thread._id, userId })
    .sort({ createdAt: 1 })
    .lean();

  return messages.map((message) => ({
    id: message.messageId,
    parent_id: message.parentId,
    format: message.format,
    content: message.content,
  }));
}

export async function saveChatMessage(
  threadId: string,
  userId: string,
  message: ChatMessageInput
): Promise<"not-found" | "invalid" | "saved"> {
  const thread = await findOwnedThread(threadId, userId);
  if (!thread) return "not-found";

  if (!message.id || !message.format || !message.content) {
    return "invalid";
  }

  await ChatMessage.findOneAndUpdate(
    { threadId: thread._id, messageId: message.id },
    {
      threadId: thread._id,
      userId,
      messageId: message.id,
      parentId: message.parent_id ?? null,
      format: message.format,
      content: message.content,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  thread.updatedAt = new Date();
  await thread.save();

  return "saved";
}
