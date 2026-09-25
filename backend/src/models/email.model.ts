import mongoose, { Schema, type Document } from "mongoose";

// --- Email Model ---

export interface IEmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface IEmailPendingAttachment {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

export type EmailDirection = "inbound" | "outbound";
export type EmailKind = "reply" | "reply_all" | "forward";
export type EmailSendStatus = "draft" | "sending" | "sent" | "failed";

export interface IEmail extends Document {
  userId: string;
  organizationId: mongoose.Types.ObjectId;
  gmailAccountId: mongoose.Types.ObjectId;
  messageId: string;
  threadId: string;
  historyId: string;
  rfcMessageId: string | null;
  references: string | null;
  inReplyTo: string | null;
  replyTo: string | null;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  date: Date;
  bodyText: string | null;
  bodyHtml: string | null;
  snippet: string | null;
  labels: string[];
  attachments: IEmailAttachment[];
  status: "received" | "processing" | "processed" | "failed";
  processedAt: Date | null;
  errorMessage: string | null;
  direction: EmailDirection;
  kind: EmailKind | null;
  inReplyToEmailId: mongoose.Types.ObjectId | null;
  sendStatus: EmailSendStatus | null;
  sendError: string | null;
  pendingAttachments: IEmailPendingAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const emailAttachmentSchema = new Schema<IEmailAttachment>(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    attachmentId: { type: String, required: true },
  },
  { _id: false }
);

const emailPendingAttachmentSchema = new Schema<IEmailPendingAttachment>(
  {
    key: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

// Outbound rows start life as drafts, before Gmail has assigned them any ids.
function requiredForInbound(this: IEmail): boolean {
  return this.direction !== "outbound";
}

const emailSchema = new Schema<IEmail>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    gmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "GmailAccount",
      required: true,
      index: true,
    },
    messageId: { type: String, required: requiredForInbound },
    threadId: { type: String, required: requiredForInbound, index: true },
    historyId: { type: String, required: requiredForInbound },
    rfcMessageId: { type: String, default: null },
    references: { type: String, default: null },
    inReplyTo: { type: String, default: null },
    replyTo: { type: String, default: null },
    from: { type: String, required: true },
    // Not required: real mail can be BCC-only (no To header) or have an empty
    // subject, and Mongoose `required` rejects "" on strings — marking these
    // required made such messages fail ingestion forever, jamming the Gmail
    // history cursor.
    to: { type: String, default: "" },
    cc: { type: String, default: null },
    bcc: { type: String, default: null },
    subject: { type: String, default: "" },
    date: { type: Date, required: true },
    bodyText: { type: String, default: null },
    bodyHtml: { type: String, default: null },
    snippet: { type: String, default: null },
    labels: { type: [String], default: [] },
    attachments: { type: [emailAttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ["received", "processing", "processed", "failed"],
      default: "received",
      index: true,
    },
    processedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "inbound",
      index: true,
    },
    kind: {
      type: String,
      enum: ["reply", "reply_all", "forward"],
      default: null,
    },
    inReplyToEmailId: {
      type: Schema.Types.ObjectId,
      ref: "Email",
      default: null,
    },
    sendStatus: {
      type: String,
      enum: ["draft", "sending", "sent", "failed"],
      default: null,
    },
    sendError: { type: String, default: null },
    pendingAttachments: { type: [emailPendingAttachmentSchema], default: [] },
  },
  { timestamps: true }
);

emailSchema.index({ userId: 1, status: 1, createdAt: -1 });
emailSchema.index({ userId: 1, from: 1, createdAt: -1 });
emailSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
emailSchema.index({ organizationId: 1, from: 1, createdAt: -1 });
emailSchema.index({ userId: 1, organizationId: 1, direction: 1, date: -1 });
emailSchema.index({ organizationId: 1, direction: 1, date: -1 });
// Inbox listing sorts every matching row by date; thread views sort a single
// conversation chronologically.
emailSchema.index({ userId: 1, organizationId: 1, date: -1 });
emailSchema.index({ gmailAccountId: 1, threadId: 1, date: 1 });
// Partial so that many drafts, which have no messageId at all, can coexist.
emailSchema.index(
  { gmailAccountId: 1, messageId: 1 },
  { unique: true, partialFilterExpression: { messageId: { $type: "string" } } }
);

export const Email = mongoose.model<IEmail>("Email", emailSchema);

// --- Gmail Sync State Model ---

export interface IGmailSyncState extends Document {
  emailAddress: string;
  historyId: string;
  watchExpiration: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const gmailSyncStateSchema = new Schema<IGmailSyncState>(
  {
    emailAddress: { type: String, required: true, unique: true },
    historyId: { type: String, required: true },
    watchExpiration: { type: Date, default: null },
  },
  { timestamps: true }
);

export const GmailSyncState = mongoose.model<IGmailSyncState>(
  "GmailSyncState",
  gmailSyncStateSchema
);
