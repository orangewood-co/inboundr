import mongoose, { Schema, type Document } from "mongoose";

import { INBOX_CHANNELS, type InboxChannel } from "./inbox-conversation.model";

export type InboxMessageDirection = "inbound" | "outbound";
export type InboxMessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface IInboxMessageAttachment {
  key: string;
  originalName: string;
  contentType: string;
  size: number;
}

export interface IInboxMessage extends Document {
  organizationId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  channel: InboxChannel;
  direction: InboxMessageDirection;
  /** Provider message id (`wamid.…`); null until an outbound send is accepted. */
  externalId: string | null;
  /** Provider message type: text, image, document, audio, location… */
  type: string;
  bodyText: string;
  attachments: IInboxMessageAttachment[];
  /** Provider timestamp for inbound messages, send time for outbound ones. */
  sentAt: Date;
  /** Outbound only: the user who sent it. */
  authorUserId: string | null;
  deliveryStatus: InboxMessageDeliveryStatus | null;
  deliveryError: string | null;
  /** Inbound only: when the RFQ pipeline consumed this message. */
  rfqProcessedAt: Date | null;
  /** RFQ this message was folded into, if any. */
  rfqId: mongoose.Types.ObjectId | null;
  /**
   * Text read out of the attachments for RFQ extraction, cached so follow-ups
   * that re-extract the whole chat do not re-run vision or PDF parsing.
   */
  extractedText: string | null;
  extractedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const inboxMessageAttachmentSchema = new Schema<IInboxMessageAttachment>(
  {
    key: { type: String, required: true },
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const inboxMessageSchema = new Schema<IInboxMessage>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "InboxConversation",
      required: true,
    },
    channel: { type: String, enum: INBOX_CHANNELS, required: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    externalId: { type: String, default: null },
    type: { type: String, default: "text" },
    bodyText: { type: String, default: "" },
    attachments: { type: [inboxMessageAttachmentSchema], default: [] },
    sentAt: { type: Date, required: true },
    authorUserId: { type: String, default: null },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed", null],
      default: null,
    },
    deliveryError: { type: String, default: null },
    rfqProcessedAt: { type: Date, default: null },
    rfqId: { type: Schema.Types.ObjectId, ref: "RFQ", default: null },
    extractedText: { type: String, default: null },
    extractedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inboxMessageSchema.index({ conversationId: 1, sentAt: 1 });
// Meta retries webhooks, so inbound messages are deduplicated on the wamid.
inboxMessageSchema.index(
  { organizationId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export const InboxMessage = mongoose.model<IInboxMessage>("InboxMessage", inboxMessageSchema);
