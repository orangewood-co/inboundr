import mongoose, { Schema, type Document } from "mongoose";

export type CallStatus = "in_progress" | "completed" | "failed";

export interface ICallTranscriptEntry {
  role: "user" | "assistant";
  text: string;
  at: Date;
}

/** Structured lead details extracted from the transcript after the call ends. */
export interface ICallExtraction {
  callerName: string;
  company: string;
  email: string;
  inquiry: string;
  followUpRequired: boolean;
}

export interface ICall extends Document {
  organizationId: mongoose.Types.ObjectId;
  callerNumber: string;
  dialedNumber: string;
  roomName: string;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  transcript: ICallTranscriptEntry[];
  summary: string;
  extraction: ICallExtraction | null;
  recordingKey: string;
  customerId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const transcriptEntrySchema = new Schema<ICallTranscriptEntry>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const extractionSchema = new Schema<ICallExtraction>(
  {
    callerName: { type: String, default: "" },
    company: { type: String, default: "" },
    email: { type: String, default: "" },
    inquiry: { type: String, default: "" },
    followUpRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const callSchema = new Schema<ICall>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    callerNumber: { type: String, default: "", trim: true },
    dialedNumber: { type: String, default: "", trim: true },
    roomName: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    transcript: { type: [transcriptEntrySchema], default: [] },
    summary: { type: String, default: "" },
    extraction: { type: extractionSchema, default: null },
    recordingKey: { type: String, default: "", trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
  },
  { timestamps: true }
);

callSchema.index({ organizationId: 1, startedAt: -1 });

export const Call = mongoose.model<ICall>("Call", callSchema);
