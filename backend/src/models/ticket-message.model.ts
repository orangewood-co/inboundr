import mongoose, { Schema, type Document } from "mongoose";

export type TicketMessageAuthorType = "visitor" | "bot" | "agent" | "system";

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
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const TicketMessage = mongoose.model<ITicketMessage>(
  "TicketMessage",
  ticketMessageSchema
);
