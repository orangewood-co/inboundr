import mongoose, { Schema, type Document } from "mongoose";

export type TicketMessageAuthorType = "visitor" | "bot" | "agent" | "system";

export interface ITicketMessage extends Document {
  ticketId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  authorType: TicketMessageAuthorType;
  bodyText: string;
  createdAt: Date;
  updatedAt: Date;
}

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
    bodyText: { type: String, required: true },
  },
  { timestamps: true }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export const TicketMessage = mongoose.model<ITicketMessage>(
  "TicketMessage",
  ticketMessageSchema
);
