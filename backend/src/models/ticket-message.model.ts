import mongoose, { Schema, type Document } from "mongoose";

export type TicketMessageAuthorType = "visitor" | "bot" | "agent" | "system";

/**
 * Delivery state for messages relayed to an external channel (WhatsApp).
 * Null for channels where delivery is implicit (live chat, phone).
 */
export type TicketMessageDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface ITicketMessageAttachment {
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  url: string | null;
}

export interface ITicketMessage extends Document {
  ticketId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  authorType: TicketMessageAuthorType;
  authorUserId: string | null;
  bodyText: string;
  attachments: ITicketMessageAttachment[];
  /** Agent-only internal note. Never surfaced to visitors. */
  isInternal: boolean;
  /** Provider message id (e.g. WhatsApp `wamid...`); used for idempotency and status updates. */
  externalId: string | null;
  deliveryStatus: TicketMessageDeliveryStatus | null;
  deliveryError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageAttachmentSchema = new Schema<ITicketMessageAttachment>(
  {
    key: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    url: { type: String, default: null },
  },
  { _id: false }
);

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    authorType: {
      type: String,
      enum: ["visitor", "bot", "agent", "system"],
      required: true,
    },
    authorUserId: { type: String, default: null, index: true },
    bodyText: { type: String, default: "" },
    attachments: { type: [ticketMessageAttachmentSchema], default: [] },
    isInternal: { type: Boolean, default: false },
    externalId: { type: String, default: null, trim: true },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: null,
    },
    deliveryError: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });
ticketMessageSchema.index(
  { organizationId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export const TicketMessage = mongoose.model<ITicketMessage>(
  "TicketMessage",
  ticketMessageSchema
);
