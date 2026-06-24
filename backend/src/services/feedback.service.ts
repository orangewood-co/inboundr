import { createElement } from "react";
import mongoose from "mongoose";
import {
  Feedback,
  FEEDBACK_MODULES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackModule,
  type FeedbackStatus,
  type FeedbackType,
  type IFeedback,
} from "../models/feedback.model";
import { Organization } from "../models/organization.model";
import { FeedbackSubmittedEmail } from "../emails/feedback-submitted";
import { FeedbackReplyEmail } from "../emails/feedback-reply";
import { sendEmail } from "../lib/email";
import { frontendOrigin } from "../config/origins.config";
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

export interface SerializedFeedbackMessage {
  _id: string;
  authorType: "user" | "admin";
  authorId: string;
  authorName: string;
  body: string;
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

function serializeMessage(message: any): SerializedFeedbackMessage {
  return {
    _id: String(message._id),
    authorType: message.authorType,
    authorId: message.authorId,
    authorName: message.authorName ?? "",
    body: message.body,
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

export function serializeFeedback(feedback: IFeedback | any): SerializedFeedback {
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
    messages: (feedback.messages ?? []).map(serializeMessage),
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

async function notifyRecipient(options: {
  subject: string;
  react: ReturnType<typeof createElement>;
  replyTo?: string[];
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
    });
  } catch (err) {
    console.error("Failed to send feedback notification email:", err);
  }
}

export async function createFeedback(input: {
  actor: FeedbackActor;
  organizationId: string | null;
  type: FeedbackType;
  module: FeedbackModule;
  message: string;
}): Promise<SerializedFeedback> {
  const organizationId =
    input.organizationId && mongoose.Types.ObjectId.isValid(input.organizationId)
      ? new mongoose.Types.ObjectId(input.organizationId)
      : null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || input.actor.email || "User";

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
      message: input.message,
      organizationName,
    }),
    replyTo: input.actor.email ? [input.actor.email] : undefined,
  });

  return serializeFeedback(feedback);
}

export async function listFeedbackForUser(
  userId: string
): Promise<SerializedFeedback[]> {
  const items = await Feedback.find({ userId })
    .sort({ lastMessageAt: -1 })
    .lean();
  return items.map(serializeFeedback);
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

  return serializeFeedback(feedback);
}

export async function addUserMessage(input: {
  feedbackId: string;
  actor: FeedbackActor;
  body: string;
}): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(input.feedbackId)) return null;

  const feedback = await Feedback.findOne({
    _id: input.feedbackId,
    userId: input.actor.id,
  });
  if (!feedback) return null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || input.actor.email || "User";
  feedback.messages.push({
    authorType: "user",
    authorId: input.actor.id,
    authorName,
    body: input.body,
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
      message: input.body,
      organizationName,
    }),
    replyTo: feedback.userEmail ? [feedback.userEmail] : undefined,
  });

  return serializeFeedback(feedback);
}

export async function addAdminMessage(input: {
  feedbackId: string;
  actor: FeedbackActor;
  body: string;
}): Promise<SerializedFeedback | null> {
  if (!mongoose.Types.ObjectId.isValid(input.feedbackId)) return null;

  const feedback = await Feedback.findById(input.feedbackId);
  if (!feedback) return null;

  const now = new Date();
  const authorName = input.actor.name?.trim() || "Inboundr Team";
  feedback.messages.push({
    authorType: "admin",
    authorId: input.actor.id,
    authorName,
    body: input.body,
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
        body: input.body.slice(0, 280),
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
          reply: input.body,
          originalMessage: firstUserMessage?.body ?? "",
          threadUrl,
        }),
      });
    } catch (err) {
      console.error("Failed to send feedback reply email:", err);
    }
  }

  return serializeFeedback(feedback);
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
    feedback: items.map(serializeFeedback),
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

  return serializeFeedback(feedback);
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

  return serializeFeedback(feedback);
}

export async function getAdminUnreadFeedbackCount(): Promise<number> {
  return Feedback.countDocuments({ unreadForAdmin: true });
}
