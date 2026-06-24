import mongoose, { Schema, type Document, type Types } from "mongoose";

export type FeedbackType = "feedback" | "feature_request" | "bug";
export type FeedbackStatus = "open" | "in_progress" | "resolved";
export type FeedbackAuthorType = "user" | "admin";

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

export interface IFeedbackMessage {
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
  body: string;
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

const feedbackMessageSchema = new Schema<IFeedbackMessage>(
  {
    authorType: { type: String, enum: ["user", "admin"], required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, default: "", trim: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
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
