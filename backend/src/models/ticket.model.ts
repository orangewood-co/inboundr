import mongoose, { Schema, type Document } from "mongoose";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketChannel = "chat" | "email" | "form";

export interface ITicketRequester {
  name: string;
  email: string;
}

export interface ITicket extends Document {
  organizationId: mongoose.Types.ObjectId;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  requester: ITicketRequester;
  /** Visitor resume key for chat-channel tickets. */
  sessionToken: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketRequesterSchema = new Schema<ITicketRequester>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { _id: false }
);

const ticketSchema = new Schema<ITicket>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    ticketNumber: { type: Number, required: true },
    subject: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["open", "pending", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    channel: {
      type: String,
      enum: ["chat", "email", "form"],
      required: true,
      index: true,
    },
    requester: { type: ticketRequesterSchema, required: true },
    sessionToken: { type: String, default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ticketSchema.index({ organizationId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index(
  { sessionToken: 1 },
  { unique: true, partialFilterExpression: { sessionToken: { $type: "string" } } }
);
ticketSchema.index({ organizationId: 1, status: 1, lastMessageAt: -1 });

export const Ticket = mongoose.model<ITicket>("Ticket", ticketSchema);
