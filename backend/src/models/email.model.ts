import mongoose, { Schema, type Document } from "mongoose";

// --- Email Model ---

export interface IEmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface IEmail extends Document {
  userId: string;
  gmailAccountId: mongoose.Types.ObjectId;
  messageId: string;
  threadId: string;
  historyId: string;
  rfcMessageId: string | null;
  references: string | null;
  inReplyTo: string | null;
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

const emailSchema = new Schema<IEmail>(
  {
    userId: { type: String, required: true, index: true },
    gmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "GmailAccount",
      required: true,
      index: true,
    },
    messageId: { type: String, required: true },
    threadId: { type: String, required: true, index: true },
    historyId: { type: String, required: true },
    rfcMessageId: { type: String, default: null },
    references: { type: String, default: null },
    inReplyTo: { type: String, default: null },
    from: { type: String, required: true },
    to: { type: String, required: true },
    cc: { type: String, default: null },
    bcc: { type: String, default: null },
    subject: { type: String, required: true },
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
  },
  { timestamps: true }
);

emailSchema.index({ userId: 1, status: 1, createdAt: -1 });
emailSchema.index({ userId: 1, from: 1, createdAt: -1 });
emailSchema.index({ gmailAccountId: 1, messageId: 1 }, { unique: true });

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
