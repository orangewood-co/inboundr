import mongoose, { Schema, type Document } from "mongoose";

export type CallSessionStatus =
  | "incoming"
  | "accepted"
  | "in_progress"
  | "completed"
  | "failed"
  | "rejected";

export type CallRecordingStatus =
  | "none"
  | "pending"
  | "stored"
  | "failed";

export type CallTranscriptRole = "caller" | "agent";

export interface ICallTranscriptEntry {
  role: CallTranscriptRole;
  text: string;
  at: Date;
}

export interface ICallSession extends Document {
  organizationId: mongoose.Types.ObjectId;
  /** Dialed Vobiz number (To header). */
  phoneNumber: string;
  /** Caller number (From header). */
  callerNumber: string;
  /** OpenAI realtime call identifier from the incoming webhook. */
  openaiCallId: string;
  /** SIP Call-ID header, used to correlate the Vobiz recording. */
  sipCallId: string | null;
  /** Vobiz CallUUID, when known (used as a fast-path correlation key). */
  vobizCallUuid: string | null;
  /** Vobiz recording id once a recording has been attached (cross-session dedupe). */
  vobizRecordingId: string | null;
  status: CallSessionStatus;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSec: number;
  ticketId: mongoose.Types.ObjectId | null;
  transcript: ICallTranscriptEntry[];
  summary: string;
  recordingStatus: CallRecordingStatus;
  recordingUrl: string | null;
  recordingKey: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const callTranscriptEntrySchema = new Schema<ICallTranscriptEntry>(
  {
    role: { type: String, enum: ["caller", "agent"], required: true },
    text: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const callSessionSchema = new Schema<ICallSession>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    phoneNumber: { type: String, default: "", trim: true },
    callerNumber: { type: String, default: "", trim: true, index: true },
    openaiCallId: { type: String, required: true, index: true },
    sipCallId: { type: String, default: null, index: true },
    vobizCallUuid: { type: String, default: null, index: true },
    vobizRecordingId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["incoming", "accepted", "in_progress", "completed", "failed", "rejected"],
      default: "incoming",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", default: null, index: true },
    transcript: { type: [callTranscriptEntrySchema], default: [] },
    summary: { type: String, default: "" },
    recordingStatus: {
      type: String,
      enum: ["none", "pending", "stored", "failed"],
      default: "none",
    },
    recordingUrl: { type: String, default: null },
    recordingKey: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

callSessionSchema.index({ openaiCallId: 1 }, { unique: true });
callSessionSchema.index({ organizationId: 1, startedAt: -1 });

export const CallSession = mongoose.model<ICallSession>(
  "CallSession",
  callSessionSchema
);
