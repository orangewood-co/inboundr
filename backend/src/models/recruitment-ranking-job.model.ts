import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentRankingJob extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId | null;
  status: "queued" | "processing" | "succeeded" | "failed" | "manual_review";
  provider: string | null;
  inputRevision: number | null;
  rubricVersion: number | null;
  batchId: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  requestedByUserId: string | null;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastErrorAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const recruitmentRankingJobSchema = new Schema<IRecruitmentRankingJob>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitmentJob", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "RecruitmentApplication", default: null, index: true },
    status: {
      type: String,
      enum: ["queued", "processing", "succeeded", "failed", "manual_review"],
      default: "queued",
      index: true,
    },
    provider: { type: String, default: null, trim: true },
    inputRevision: { type: Number, default: null, min: 1 },
    rubricVersion: { type: Number, default: null, min: 1 },
    batchId: { type: String, default: null, trim: true, index: true },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null, maxlength: 5000 },
    requestedByUserId: { type: String, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1, max: 10 },
    availableAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lastErrorAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recruitmentRankingJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
recruitmentRankingJobSchema.index({
  organizationId: 1,
  status: 1,
  availableAt: 1,
  createdAt: 1,
});
recruitmentRankingJobSchema.index({
  applicationId: 1,
  inputRevision: 1,
  rubricVersion: 1,
  createdAt: -1,
});

export const RecruitmentRankingJob = mongoose.model<IRecruitmentRankingJob>(
  "RecruitmentRankingJob",
  recruitmentRankingJobSchema
);
