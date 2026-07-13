import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentAcknowledgementDelivery extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  applicationRevision: number;
  recipient: string;
  candidateName: string;
  jobTitle: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  messageId: string | null;
  error: string | null;
  queuedAt: Date;
  sendingAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IRecruitmentAcknowledgementDelivery>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitmentJob", required: true, index: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentApplication",
      required: true,
      index: true,
    },
    applicationRevision: { type: Number, required: true, min: 1 },
    recipient: { type: String, required: true, trim: true, lowercase: true },
    candidateName: { type: String, required: true, trim: true, maxlength: 200 },
    jobTitle: { type: String, required: true, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    messageId: { type: String, default: null, trim: true },
    error: { type: String, default: null, maxlength: 5000 },
    queuedAt: { type: Date, default: Date.now },
    sendingAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ applicationId: 1, applicationRevision: 1 }, { unique: true });
schema.index({ status: 1, queuedAt: 1 });

export const RecruitmentAcknowledgementDelivery =
  mongoose.model<IRecruitmentAcknowledgementDelivery>(
    "RecruitmentAcknowledgementDelivery",
    schema
  );
