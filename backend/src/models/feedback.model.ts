import mongoose, { Schema, type Document, type Types } from "mongoose";

export type FeedbackType = "feedback" | "feature_request" | "bug";
export type FeedbackStatus = "open" | "in_progress" | "resolved";
export type FeedbackAuthorType = "user" | "admin";

export const FEEDBACK_MAX_ATTACHMENTS = 3;
export const FEEDBACK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const FEEDBACK_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const FEEDBACK_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const FEEDBACK_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const FEEDBACK_ATTACHMENT_MIME_TYPES = [
  ...FEEDBACK_IMAGE_MIME_TYPES,
  ...FEEDBACK_VIDEO_MIME_TYPES,
] as const;

export const FEEDBACK_TYPES: FeedbackType[] = [
  "feedback",
  "feature_request",
  "bug",
];

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "open",
  "in_progress",
  "resolved",
];

/**
 * Known product areas a submission can be tagged with. Kept loosely in sync
 * with the frontend module list; unknown values fall back to "general".
 */
export const FEEDBACK_MODULES = [
  "general",
  "home",
  "rfq",
  "emails",
  "orders",
  "stats",
  "chat",
  "support",
  "products",
  "invoices",
  "receivables",
  "customers",
  "employees",
  "projects",
  "forms",
  "links",
  "drive",
  "settings",
] as const;

export type FeedbackModule = (typeof FEEDBACK_MODULES)[number];
export type FeedbackAttachmentContentType =
  (typeof FEEDBACK_ATTACHMENT_MIME_TYPES)[number];

export interface IFeedbackMessageAttachment {
  key: string;
  originalName: string;
  contentType: FeedbackAttachmentContentType;
  size: number;
  uploadedAt?: Date;
}

export interface IFeedbackMessage {
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
  body: string;
  attachments: IFeedbackMessageAttachment[];
  createdAt: Date;
}

export interface IFeedback extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: Types.ObjectId | null;
  type: FeedbackType;
  module: FeedbackModule;
  status: FeedbackStatus;
  messages: IFeedbackMessage[];
  unreadForAdmin: boolean;
  unreadForUser: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackMessageAttachmentSchema = new Schema<IFeedbackMessageAttachment>(
  {
    key: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true, maxlength: 180 },
    contentType: {
      type: String,
      enum: FEEDBACK_ATTACHMENT_MIME_TYPES,
      required: true,
    },
    size: { type: Number, required: true, min: 1 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const feedbackMessageSchema = new Schema<IFeedbackMessage>(
  {
    authorType: { type: String, enum: ["user", "admin"], required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, default: "", trim: true },
    body: { type: String, default: "", trim: true, maxlength: 5000 },
    attachments: { type: [feedbackMessageAttachmentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const feedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, default: "", trim: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: FEEDBACK_TYPES,
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: FEEDBACK_MODULES,
      default: "general",
      index: true,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "open",
      index: true,
    },
    messages: { type: [feedbackMessageSchema], default: [] },
    unreadForAdmin: { type: Boolean, default: true },
    unreadForUser: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

feedbackSchema.index({ userId: 1, lastMessageAt: -1 });
feedbackSchema.index({ status: 1, lastMessageAt: -1 });

export const Feedback = mongoose.model<IFeedback>("Feedback", feedbackSchema);
