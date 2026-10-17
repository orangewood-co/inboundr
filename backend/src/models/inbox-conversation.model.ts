import mongoose, { Schema, type Document } from "mongoose";

/** Non-email Inbox channels. Email threads are still derived from the Email collection. */
export type InboxChannel = "whatsapp";

export const INBOX_CHANNELS: InboxChannel[] = ["whatsapp"];

export interface IInboxParticipant {
  name: string;
  phoneNumber: string | null;
  email: string | null;
}

export interface IInboxClassification {
  isRFQ: boolean;
  reason: string;
  classifiedAt: Date;
}

/**
 * One customer's chat on a non-email channel (today: the organization's RFQ
 * WhatsApp number), shown as a single row in its owner's Inbox. It lives as
 * long as the contact does; each RFQ the customer sends is a stretch of
 * messages within it, tracked through `rfqId`.
 */
export interface IInboxConversation extends Document {
  organizationId: mongoose.Types.ObjectId;
  /** Owner whose Inbox and RFQ list this conversation belongs to. */
  userId: string;
  channel: InboxChannel;
  /** Connected account the chat runs through (a WhatsAppAccount for WhatsApp). */
  accountId: mongoose.Types.ObjectId;
  /** Customer's address on the channel: `+E.164` for WhatsApp. */
  externalId: string;
  participant: IInboxParticipant;
  customerId: mongoose.Types.ObjectId | null;
  snippet: string;
  messageCount: number;
  hasAttachments: boolean;
  lastMessageAt: Date;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  /** Newest inbound provider message id, used for read receipts. */
  lastInboundExternalId: string | null;
  lastReadExternalId: string | null;
  /** Most recent RFQ created from this chat. Kept after the RFQ closes. */
  rfqId: mongoose.Types.ObjectId | null;
  /**
   * Set while customer messages are waiting for RFQ processing: the time the
   * chat has been quiet long enough to process them as one batch.
   */
  rfqDueAt: Date | null;
  /** Claim marker so only one worker processes a chat at a time. */
  rfqProcessingStartedAt: Date | null;
  lastClassification: IInboxClassification | null;
  rfqErrorMessage: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inboxConversationSchema = new Schema<IInboxConversation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: { type: String, required: true },
    channel: { type: String, enum: INBOX_CHANNELS, required: true },
    accountId: { type: Schema.Types.ObjectId, required: true },
    externalId: { type: String, required: true, trim: true },
    participant: {
      name: { type: String, default: "" },
      phoneNumber: { type: String, default: null },
      email: { type: String, default: null },
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    snippet: { type: String, default: "" },
    messageCount: { type: Number, default: 0 },
    hasAttachments: { type: Boolean, default: false },
    lastMessageAt: { type: Date, required: true },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
    lastInboundExternalId: { type: String, default: null },
    lastReadExternalId: { type: String, default: null },
    rfqId: { type: Schema.Types.ObjectId, ref: "RFQ", default: null },
    rfqDueAt: { type: Date, default: null },
    rfqProcessingStartedAt: { type: Date, default: null },
    lastClassification: {
      type: {
        isRFQ: { type: Boolean, required: true },
        reason: { type: String, default: "" },
        classifiedAt: { type: Date, required: true },
      },
      default: null,
      _id: false,
    },
    rfqErrorMessage: { type: String, default: null },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

inboxConversationSchema.index(
  { organizationId: 1, channel: 1, externalId: 1 },
  { unique: true }
);
inboxConversationSchema.index({ organizationId: 1, userId: 1, lastMessageAt: -1 });
inboxConversationSchema.index(
  { rfqDueAt: 1 },
  { partialFilterExpression: { rfqDueAt: { $type: "date" } } }
);
inboxConversationSchema.index(
  { rfqProcessingStartedAt: 1 },
  { partialFilterExpression: { rfqProcessingStartedAt: { $type: "date" } } }
);

export const InboxConversation = mongoose.model<IInboxConversation>(
  "InboxConversation",
  inboxConversationSchema
);
