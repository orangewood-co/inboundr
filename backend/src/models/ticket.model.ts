import mongoose, { Schema, type Document } from "mongoose";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketChannel = "chat" | "email" | "form";
export type TicketAiMode = "autonomous" | "review" | "paused";

export interface ITicketRequester {
  name: string;
  email: string;
}

export interface ITicketVisitorFeedback {
  rating: number | null;
  comment: string;
  submittedAt: Date | null;
}

export interface ITicket extends Document {
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId | null;
  ticketNumber: number;
  subject: string;
  initialIssue: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  requester: ITicketRequester;
  /** Visitor resume key for chat-channel tickets. */
  sessionToken: string | null;
  emailTranscriptRequested: boolean;
  botEnabled: boolean;
  aiMode: TicketAiMode;
  lastMessageAt: Date;
  lastVisitorMessageAt: Date | null;
  lastAgentMessageAt: Date | null;
  lastVisitorReadAt: Date | null;
  lastAgentReadAt: Date | null;
  visitorEndedAt: Date | null;
  visitorFeedback: ITicketVisitorFeedback;
  transcriptEmailSentAt: Date | null;
  resolvedEmailSentAt: Date | null;
  resolvedAt: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
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

const ticketVisitorFeedbackSchema = new Schema<ITicketVisitorFeedback>(
  {
    rating: { type: Number, default: null, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 2000 },
    submittedAt: { type: Date, default: null },
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    ticketNumber: { type: Number, required: true },
    subject: { type: String, default: "", trim: true },
    initialIssue: { type: String, default: "", trim: true, maxlength: 2000 },
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
    emailTranscriptRequested: { type: Boolean, default: false },
    botEnabled: { type: Boolean, default: true },
    aiMode: {
      type: String,
      enum: ["autonomous", "review", "paused"],
      default: "autonomous",
      index: true,
    },
    lastMessageAt: { type: Date, default: Date.now },
    lastVisitorMessageAt: { type: Date, default: null },
    lastAgentMessageAt: { type: Date, default: null },
    lastVisitorReadAt: { type: Date, default: null },
    lastAgentReadAt: { type: Date, default: null },
    visitorEndedAt: { type: Date, default: null },
    visitorFeedback: { type: ticketVisitorFeedbackSchema, default: () => ({}) },
    transcriptEmailSentAt: { type: Date, default: null },
    resolvedEmailSentAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ organizationId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index(
  { sessionToken: 1 },
  { unique: true, partialFilterExpression: { sessionToken: { $type: "string" } } }
);
ticketSchema.index({ organizationId: 1, status: 1, lastMessageAt: -1 });
ticketSchema.index({ organizationId: 1, customerId: 1, lastMessageAt: -1 });
ticketSchema.index({ organizationId: 1, isArchived: 1, lastMessageAt: -1 });

export const Ticket = mongoose.model<ITicket>("Ticket", ticketSchema);
