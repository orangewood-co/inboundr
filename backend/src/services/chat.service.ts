import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import mongoose from "mongoose";

import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { ChatMessage } from "../models/chat-message.model";
import { ChatThread, type ChatThreadStatus } from "../models/chat-thread.model";
import { createInvoiceTools } from "../tools/invoice.tool";
import { createProductTools } from "../tools/product.tool";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});

const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2.6";
const DEFAULT_TITLE_MODEL = "openai/gpt-5.4-nano";
const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Inboundr users.

You can help users search and add products to their catalog when tools are available. You cannot remove products.
After using a tool, summarize the result clearly for the user.

You can also help users with invoices:
- Before creating an invoice, resolve the customer with searchCustomers and pass its customerId. If several customers match, ask the user which one they mean. If there is no matching customer, fill in customerSnapshot from what the user tells you.
- Use searchProducts to look up unitPrice, gstRate, hsnCode, and productId for catalog products before adding them as line items.
- Invoices you create are always drafts. Create the draft directly once the customer and line items are clear; only ask for confirmation when something is ambiguous or missing.
- Only draft invoices can be edited. When updating line items, send the complete list of items the invoice should have.
- You cannot send invoices. If the user asks to send one, use sendInvoice and relay its instructions; never claim an invoice was sent.
- Amounts are in INR.`;

export type ChatStreamInput = {
  messages?: UIMessage[];
  system?: string;
  tools?: Record<string, unknown>;
};

export type ChatStreamContext = {
  user: AuthenticatedRequest["user"];
  organization: OrganizationRequest["organization"];
  organizationMembership: OrganizationRequest["organizationMembership"];
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

export async function createChatStreamResponse(
  input: ChatStreamInput,
  context: ChatStreamContext
): Promise<globalThis.Response> {
  const aiTools = {
    ...createProductTools(context),
    ...createInvoiceTools(context),
    ...frontendTools((input.tools ?? {}) as Parameters<typeof frontendTools>[0]),
  };
  const result = streamText({
    model: openrouter(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
    system: input.system ? `${DEFAULT_CHAT_SYSTEM_PROMPT}\n\n${input.system}` : DEFAULT_CHAT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(input.messages ?? [], { tools: aiTools }),
    tools: aiTools,
    stopWhen: stepCountIs(5),
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

  // Source: https://github.com/open-webui/open-webui/blob/b5f4c85bb196c16a775802907aedd87366f58b0f/backend/open_webui/config.py#L1358
  const TITLE_GENERATION_PROMPT = `
    ### Task:
    Generate a concise, 3-5 word title with an emoji summarizing the chat history.
    ### Guidelines:
    - The title should clearly represent the main theme or subject of the conversation.
    - Use emojis that enhance understanding of the topic, but avoid quotation marks or special formatting.
    - Write the title in the chat's primary language; default to English if multilingual.
    - Prioritize accuracy over excessive creativity; keep it clear and simple.
    - Your entire response must consist solely of the title, without any introductory or concluding text.
    - Ensure no conversational text, affirmations, or explanations precede or follow the title, as this will cause direct parsing failure.
    ### Output:
    Reply with only the title, no other text or formatting.
    ### Examples:
    - "📉 Stock Market Trends"
    - "🍪 Perfect Chocolate Chip Recipe"
    - "Evolution of Music Streaming"
    - "Remote Work Productivity Tips"
    - "Artificial Intelligence in Healthcare"
    - "🎮 Video Game Development Insights"
  `
  const result = await generateText({
    model: openrouter(process.env.CHAT_TITLE_MODEL ?? DEFAULT_TITLE_MODEL),
    system: TITLE_GENERATION_PROMPT,
    prompt: JSON.stringify(messages ?? []).slice(0, 6000),
  });
  const title = result.text.trim().replace(/^["'`]+|["'`.]+$/g, "").slice(0, 80);
  thread.title = title || "New Chat";
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
