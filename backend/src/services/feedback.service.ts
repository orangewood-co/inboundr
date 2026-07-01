import { createElement } from "react";
import mongoose from "mongoose";
import {
  Feedback,
  FEEDBACK_ATTACHMENT_MIME_TYPES,
  FEEDBACK_IMAGE_MIME_TYPES,
  FEEDBACK_IMAGE_MAX_BYTES,
  FEEDBACK_MODULES,
  FEEDBACK_MAX_ATTACHMENTS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  FEEDBACK_VIDEO_MAX_BYTES,
  type FeedbackModule,
  type FeedbackStatus,
  type FeedbackType,
  type FeedbackAttachmentContentType,
  type IFeedback,
  type IFeedbackMessageAttachment,
} from "../models/feedback.model";
import { Organization } from "../models/organization.model";
import { FeedbackSubmittedEmail } from "../emails/feedback-submitted";
import { FeedbackReplyEmail } from "../emails/feedback-reply";
import { sendEmail, type SendEmailAttachment } from "../lib/email";
import { frontendOrigin } from "../config/origins.config";
import { createPresignedViewUrl, getObjectBuffer, keyBelongsToPrefix } from "./storage.service";
import { createNotificationForRecipient } from "./notification.service";

const TYPE_LABELS: Record<FeedbackType, string> = {
  feedback: "Feedback",
  feature_request: "Feature Request",
  bug: "Bug Report",
};

const MODULE_LABELS: Record<FeedbackModule, string> = {
  general: "General",
  home: "Home",
  rfq: "RFQ",
  emails: "Inbox",
  orders: "Orders",
  stats: "Stats",
  chat: "AI Chat",
  support: "Support",
  products: "Products",
  invoices: "Invoices",
  receivables: "Receivables",
  customers: "Customers",
  employees: "Employees",
  projects: "Projects",
  forms: "Forms",
  links: "Links",
  drive: "Drive",
  settings: "Settings",
};

export interface FeedbackActor {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface FeedbackAttachmentInput {
  key: string;
  originalName: string;
  contentType: FeedbackAttachmentContentType;
  size: number;
}

export interface SerializedFeedbackAttachment {
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  url: string | null;
}

export interface SerializedFeedbackMessage {
  _id: string;
  authorType: "user" | "admin";
  authorId: string;
  authorName: string;
  body: string;
  attachments: SerializedFeedbackAttachment[];
  createdAt: string;
}

export interface SerializedFeedback {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: string | null;
  type: FeedbackType;
  typeLabel: string;
  module: FeedbackModule;
  moduleLabel: string;
  status: FeedbackStatus;
  messages: SerializedFeedbackMessage[];
  attachmentCount: number;
  unreadForAdmin: boolean;
  unreadForUser: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeFeedbackType(value: unknown): FeedbackType | null {
  return FEEDBACK_TYPES.includes(value as FeedbackType)
    ? (value as FeedbackType)
    : null;
}

export function normalizeFeedbackModule(value: unknown): FeedbackModule {
  return FEEDBACK_MODULES.includes(value as FeedbackModule)
    ? (value as FeedbackModule)
    : "general";
}

export function normalizeFeedbackStatus(value: unknown): FeedbackStatus | null {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus)
    ? (value as FeedbackStatus)
    : null;
}

function maxBytesForFeedbackAttachment(contentType: string): number {
  return FEEDBACK_IMAGE_MIME_TYPES.includes(contentType as any)
    ? FEEDBACK_IMAGE_MAX_BYTES
    : FEEDBACK_VIDEO_MAX_BYTES;
}

export function normalizeFeedbackAttachments(
  value: unknown,
  actorUserId: string
): { attachments: FeedbackAttachmentInput[]; error: string | null } {
  const rawAttachments = Array.isArray(value) ? value : [];
  if (rawAttachments.length > FEEDBACK_MAX_ATTACHMENTS) {
    return {
      attachments: [],
      error: `You can attach up to ${FEEDBACK_MAX_ATTACHMENTS} files`,
    };
  }

  const attachments: FeedbackAttachmentInput[] = [];
  const seenKeys = new Set<string>();
  for (const raw of rawAttachments) {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const key = String(item.key ?? "").trim();
    const originalName = String(item.originalName ?? "").trim();
    const contentType = String(item.contentType ?? "").trim().toLowerCase();
    const size = Number(item.size ?? 0);

    if (!key || !originalName || !contentType || !Number.isFinite(size) || size <= 0) {
      return { attachments: [], error: "Attachment metadata is invalid" };
    }
    if (seenKeys.has(key)) {
      return { attachments: [], error: "Duplicate attachments are not allowed" };
    }
    if (!keyBelongsToPrefix(key, ["feedback", actorUserId])) {
      return { attachments: [], error: "Attachment does not belong to this user" };
    }
    if (!FEEDBACK_ATTACHMENT_MIME_TYPES.includes(contentType as any)) {
      return { attachments: [], error: "This file type is not allowed" };
    }
    if (size > maxBytesForFeedbackAttachment(contentType)) {
      const limitMb = Math.round(maxBytesForFeedbackAttachment(contentType) / 1024 / 1024);
      return { attachments: [], error: `Attachment must be ${limitMb}MB or smaller` };
    }

    seenKeys.add(key);
    attachments.push({
      key,
      originalName: originalName.slice(0, 180),
      contentType: contentType as FeedbackAttachmentContentType,
      size,
    });
  }

  return { attachments, error: null };
}

export function hasFeedbackMessageContent(
  message: string,
  attachments: FeedbackAttachmentInput[]
): boolean {
  return message.trim().length > 0 || attachments.length > 0;
}

async function serializeAttachment(
  attachment: IFeedbackMessageAttachment | any,
  includeAttachmentUrls: boolean
): Promise<SerializedFeedbackAttachment> {
  let url: string | null = null;
  if (includeAttachmentUrls) {
    try {
      url = (await createPresignedViewUrl(attachment.key)).url;
    } catch (err) {
      console.error("Failed to create feedback attachment view URL:", err);
    }
  }

  return {
    key: attachment.key,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    size: Number(attachment.size ?? 0),
    url,
  };
}

async function serializeMessage(
  message: any,
  includeAttachmentUrls: boolean
): Promise<SerializedFeedbackMessage> {
  return {
    _id: String(message._id),
    authorType: message.authorType,
    authorId: message.authorId,
    authorName: message.authorName ?? "",
    body: message.body ?? "",
    attachments: await Promise.all(
      (message.attachments ?? []).map((attachment: any) =>
        serializeAttachment(attachment, includeAttachmentUrls)
      )
    ),
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

function feedbackAttachmentCount(feedback: IFeedback | any): number {
  return (feedback.messages ?? []).reduce(
    (sum: number, message: any) => sum + (message.attachments?.length ?? 0),
    0
  );
}

export async function serializeFeedback(
  feedback: IFeedback | any,
  options: { includeAttachmentUrls?: boolean } = {}
): Promise<SerializedFeedback> {
  const includeAttachmentUrls = Boolean(options.includeAttachmentUrls);
  return {
    _id: String(feedback._id),
    userId: feedback.userId,
    userEmail: feedback.userEmail,
    userName: feedback.userName ?? "",
    organizationId: feedback.organizationId ? String(feedback.organizationId) : null,
    type: feedback.type,
    typeLabel: TYPE_LABELS[feedback.type as FeedbackType] ?? feedback.type,
    module: feedback.module,
    moduleLabel: MODULE_LABELS[feedback.module as FeedbackModule] ?? feedback.module,
    status: feedback.status,
    messages: await Promise.all(
      (feedback.messages ?? []).map((message: any) =>
        serializeMessage(message, includeAttachmentUrls)
      )
    ),
    attachmentCount: feedbackAttachmentCount(feedback),
    unreadForAdmin: Boolean(feedback.unreadForAdmin),
    unreadForUser: Boolean(feedback.unreadForUser),
    lastMessageAt: new Date(feedback.lastMessageAt).toISOString(),
    createdAt: new Date(feedback.createdAt).toISOString(),
    updatedAt: new Date(feedback.updatedAt).toISOString(),
  };
}

function feedbackRecipientEmail(): string | null {
  const explicit = process.env.FEEDBACK_RECIPIENT_EMAIL?.trim();
  if (explicit) return explicit;

  const firstSuperAdmin = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)[0];
  return firstSuperAdmin ?? null;
}

async function resolveOrganizationName(
  organizationId: mongoose.Types.ObjectId | null
): Promise<string | null> {
  if (!organizationId) return null;
  const organization = await Organization.findById(organizationId)
    .select({ name: 1 })
    .lean();
  return organization?.name ?? null;
}

function attachmentCounts(attachments: FeedbackAttachmentInput[] = []) {
  const images = attachments.filter((attachment) =>
    FEEDBACK_IMAGE_MIME_TYPES.includes(attachment.contentType as any)
  ).length;
  const videos = attachments.length - images;
  return { images, videos, total: attachments.length };
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function attachmentSummary(attachments: FeedbackAttachmentInput[] = []): string {
  const { images, videos, total } = attachmentCounts(attachments);
  if (total === 0) return "";
  const parts = [
    images > 0 ? pluralize(images, "screenshot") : "",
    videos > 0 ? pluralize(videos, "video") : "",
  ].filter(Boolean);
  return `Includes ${parts.join(" and ")}.`;
}

function messageForEmail(body: string, attachments: FeedbackAttachmentInput[] = []): string {
  const trimmed = body.trim();
  if (trimmed) return trimmed;
  return attachmentSummary(attachments) || "Shared an attachment.";
}

function messagePreview(body: string, attachments: FeedbackAttachmentInput[] = []): string {
  const trimmed = body.trim();
  if (trimmed) return trimmed.slice(0, 280);
  return (attachmentSummary(attachments) || "Shared an attachment.").slice(0, 280);
}

async function imageEmailAttachments(
  attachments: FeedbackAttachmentInput[] = []
): Promise<SendEmailAttachment[]> {
  const images = attachments.filter((attachment) =>
    FEEDBACK_IMAGE_MIME_TYPES.includes(attachment.contentType as any)
  );

  return Promise.all(
    images.map(async (attachment) => ({
      filename: attachment.originalName,
      contentType: attachment.contentType,
      content: await getObjectBuffer(attachment.key),
    }))
  );
}

async function notifyRecipient(options: {
  subject: string;
  react: ReturnType<typeof createElement>;
  replyTo?: string[];
  attachments?: FeedbackAttachmentInput[];
}): Promise<void> {
  const recipient = feedbackRecipientEmail();
  if (!recipient) {
    console.warn(
      "FEEDBACK_RECIPIENT_EMAIL is not set and SUPER_ADMIN_EMAILS is empty; skipping feedback email"
    );
    return;
  }

  try {
    await sendEmail({
      to: recipient,
      subject: options.subject,
      react: options.react as any,
      replyTo: options.replyTo,
      attachments: await imageEmailAttachments(options.attachments),
    });
  } catch (err) {
    console.error("Failed to send feedback notification email:", err);
    if (options.attachments?.length) {
      try {
        await sendEmail({
          to: recipient,
          subject: options.subject,
          react: options.react as any,
          replyTo: options.replyTo,
        });
      } catch (fallbackErr) {
        console.error("Failed to send feedback notification fallback email:", fallbackErr);
      }
    }
  }
}

export async function createFeedback(input: {
  actor: FeedbackActor;
  organizationId: string | null;
  type: FeedbackType;
  module: FeedbackModule;
  message: string;
  attachments?: FeedbackAttachmentInput[];
}): Promise<SerializedFeedback> {
  const organizationId =
    input.organizationId && mongoose.Types.ObjectId.isValid(input.organizationId)
      ? new mongoose.Types.ObjectId(input.organizationId)
      : null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || input.actor.email || "User";
  const attachments = input.attachments ?? [];

  const feedback = await Feedback.create({
    userId: input.actor.id,
    userEmail: (input.actor.email ?? "").toLowerCase(),
    userName: input.actor.name ?? "",
    organizationId,
    type: input.type,
    module: input.module,
    status: "open",
    messages: [
      {
        authorType: "user",
        authorId: input.actor.id,
        authorName,
        body: input.message,
        attachments,
        createdAt: now,
      },
    ],
    unreadForAdmin: true,
    unreadForUser: false,
    lastMessageAt: now,
  });

  const organizationName = await resolveOrganizationName(organizationId);

  await notifyRecipient({
    subject: `New ${TYPE_LABELS[input.type]}: ${MODULE_LABELS[input.module]}`,
    react: createElement(FeedbackSubmittedEmail, {
      name: authorName,
      email: input.actor.email ?? "",
      typeLabel: TYPE_LABELS[input.type],
      moduleLabel: MODULE_LABELS[input.module],
      message: messageForEmail(input.message, attachments),
      attachmentSummary: attachmentSummary(attachments),
      organizationName,
    }),
    replyTo: input.actor.email ? [input.actor.email] : undefined,
    attachments,
  });

  return await serializeFeedback(feedback, { includeAttachmentUrls: true });
}

export async function listFeedbackForUser(
  userId: string
): Promise<SerializedFeedback[]> {
  const items = await Feedback.find({ userId })
    .sort({ lastMessageAt: -1 })
    .lean();
  return Promise.all(items.map((item) => serializeFeedback(item)));
}

export async function getFeedbackForUser(
  feedbackId: string,
  userId: string,
  options: { markRead?: boolean } = {}
): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(feedbackId)) return null;

  const feedback = await Feedback.findOne({ _id: feedbackId, userId });
  if (!feedback) return null;

  if (options.markRead && feedback.unreadForUser) {
    feedback.unreadForUser = false;
    await feedback.save();
  }

  return await serializeFeedback(feedback, { includeAttachmentUrls: true });
}

export async function addUserMessage(input: {
  feedbackId: string;
  actor: FeedbackActor;
  body: string;
  attachments?: FeedbackAttachmentInput[];
}): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(input.feedbackId)) return null;

  const feedback = await Feedback.findOne({
    _id: input.feedbackId,
    userId: input.actor.id,
  });
  if (!feedback) return null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || input.actor.email || "User";
  const attachments = input.attachments ?? [];
  feedback.messages.push({
    authorType: "user",
    authorId: input.actor.id,
    authorName,
    body: input.body,
    attachments,
    createdAt: now,
  });
  feedback.unreadForAdmin = true;
  feedback.lastMessageAt = now;
  if (feedback.status === "resolved") feedback.status = "open";
  await feedback.save();

  const organizationName = await resolveOrganizationName(feedback.organizationId);

  await notifyRecipient({
    subject: `New reply on ${TYPE_LABELS[feedback.type]}: ${MODULE_LABELS[feedback.module]}`,
    react: createElement(FeedbackSubmittedEmail, {
      name: authorName,
      email: feedback.userEmail,
      typeLabel: TYPE_LABELS[feedback.type],
      moduleLabel: MODULE_LABELS[feedback.module],
      message: messageForEmail(input.body, attachments),
      attachmentSummary: attachmentSummary(attachments),
      organizationName,
    }),
    replyTo: feedback.userEmail ? [feedback.userEmail] : undefined,
    attachments,
  });

  return await serializeFeedback(feedback, { includeAttachmentUrls: true });
}

export async function addAdminMessage(input: {
  feedbackId: string;
  actor: FeedbackActor;
  body: string;
  attachments?: FeedbackAttachmentInput[];
}): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(input.feedbackId)) return null;

  const feedback = await Feedback.findById(input.feedbackId);
  if (!feedback) return null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || "Inboundr Team";
  const attachments = input.attachments ?? [];
  feedback.messages.push({
    authorType: "admin",
    authorId: input.actor.id,
    authorName,
    body: input.body,
    attachments,
    createdAt: now,
  });
  feedback.unreadForUser = true;
  feedback.unreadForAdmin = false;
  feedback.lastMessageAt = now;
  if (feedback.status === "open") feedback.status = "in_progress";
  await feedback.save();

  const firstUserMessage = feedback.messages.find(
    (message) => message.authorType === "user"
  );
  const threadUrl = `${frontendOrigin}/feedback`;

  // In-app notification (org-scoped; only when the user has an active org and
  // is still a member). Failures must not break the reply.
  if (feedback.organizationId) {
    try {
      await createNotificationForRecipient({
        organizationId: feedback.organizationId,
        recipientUserId: feedback.userId,
        type: "feedback.reply",
        title: "New Reply to Your Feedback",
        body: messagePreview(input.body, attachments),
        actionUrl: "/feedback",
        actorUserId: input.actor.id,
        entityType: "feedback",
        entityId: String(feedback._id),
        metadata: { module: feedback.module, feedbackType: feedback.type },
      });
    } catch (err) {
      console.error("Failed to create feedback reply notification:", err);
    }
  }

  if (feedback.userEmail) {
    try {
      await sendEmail({
        to: feedback.userEmail,
        subject: "We replied to your feedback",
        react: createElement(FeedbackReplyEmail, {
          name: feedback.userName || feedback.userEmail,
          reply: messageForEmail(input.body, attachments),
          originalMessage: firstUserMessage?.body ?? "",
          attachmentSummary: attachmentSummary(attachments),
          threadUrl,
        }),
        attachments: await imageEmailAttachments(attachments),
      });
    } catch (err) {
      console.error("Failed to send feedback reply email:", err);
      if (attachments.length > 0) {
        try {
          await sendEmail({
            to: feedback.userEmail,
            subject: "We replied to your feedback",
            react: createElement(FeedbackReplyEmail, {
              name: feedback.userName || feedback.userEmail,
              reply: messageForEmail(input.body, attachments),
              originalMessage: firstUserMessage?.body ?? "",
              attachmentSummary: attachmentSummary(attachments),
              threadUrl,
            }),
          });
        } catch (fallbackErr) {
          console.error("Failed to send feedback reply fallback email:", fallbackErr);
        }
      }
    }
  }

  return await serializeFeedback(feedback, { includeAttachmentUrls: true });
}

export interface AdminFeedbackFilters {
  type?: FeedbackType | null;
  status?: FeedbackStatus | null;
  unreadOnly?: boolean;
}

export async function listFeedbackForAdmin(
  filters: AdminFeedbackFilters = {}
): Promise<{ feedback: SerializedFeedback[]; unreadCount: number }> {
  const query: Record<string, unknown> = {};
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.unreadOnly) query.unreadForAdmin = true;

  const [items, unreadCount] = await Promise.all([
    Feedback.find(query).sort({ lastMessageAt: -1 }).lean(),
    Feedback.countDocuments({ unreadForAdmin: true }),
  ]);

  return {
    feedback: await Promise.all(items.map((item) => serializeFeedback(item))),
    unreadCount,
  };
}

export async function getFeedbackForAdmin(
  feedbackId: string,
  options: { markRead?: boolean } = {}
): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(feedbackId)) return null;

  const feedback = await Feedback.findById(feedbackId);
  if (!feedback) return null;

  if (options.markRead && feedback.unreadForAdmin) {
    feedback.unreadForAdmin = false;
    await feedback.save();
  }

  return await serializeFeedback(feedback, { includeAttachmentUrls: true });
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus
): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(feedbackId)) return null;

  const feedback = await Feedback.findByIdAndUpdate(
    feedbackId,
    { $set: { status } },
    { new: true }
  );
  if (!feedback) return null;

  return await serializeFeedback(feedback);
}

export async function getAdminUnreadFeedbackCount(): Promise<number> {
  return Feedback.countDocuments({ unreadForAdmin: true });
}
