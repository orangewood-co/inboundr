import mongoose, { Schema, type Document, type Types } from "mongoose";

export const RECRUITMENT_APPLICATION_STATUSES = [
  "active",
  "hired",
  "rejected",
  "withdrawn",
  "archived",
] as const;
export type RecruitmentApplicationStatus = (typeof RECRUITMENT_APPLICATION_STATUSES)[number];

export interface IRecruitmentApplication extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  candidateId: Types.ObjectId;
  stageId: string;
  status: RecruitmentApplicationStatus;
  source: string;
  answers: Record<string, unknown>;
  formSchemaSnapshot: Record<string, unknown>;
  resumeAttachmentId: Types.ObjectId | null;
  submissionMetadata: Record<string, unknown>;
  ranking: Record<string, unknown>;
  pipelineOrder: number;
  revision: number;
  appliedAt: Date;
  lastStageChangedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const recruitmentApplicationSchema = new Schema<IRecruitmentApplication>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitmentJob", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitmentCandidate", required: true, index: true },
    stageId: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: RECRUITMENT_APPLICATION_STATUSES, default: "active", index: true },
    source: { type: String, default: "manual", trim: true, maxlength: 80 },
    answers: { type: Schema.Types.Mixed, default: () => ({}) },
    formSchemaSnapshot: {
      type: Schema.Types.Mixed,
      default: () => ({ schemaVersion: 1, fields: [] }),
      immutable: true,
    },
    resumeAttachmentId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentAttachment",
      default: null,
    },
    submissionMetadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ranking: { type: Schema.Types.Mixed, default: () => ({ status: "not_requested" }) },
    pipelineOrder: { type: Number, default: 0 },
    revision: { type: Number, default: 1, min: 1 },
    appliedAt: { type: Date, default: Date.now, index: true },
    lastStageChangedAt: { type: Date, default: Date.now },
    createdByUserId: { type: String, default: null, index: true },
    updatedByUserId: { type: String, default: null },
  },
  { timestamps: true }
);

recruitmentApplicationSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
recruitmentApplicationSchema.index({ organizationId: 1, jobId: 1, stageId: 1, pipelineOrder: 1 });
recruitmentApplicationSchema.index({ organizationId: 1, candidateId: 1, updatedAt: -1 });
recruitmentApplicationSchema.index({ organizationId: 1, status: 1, appliedAt: -1 });
recruitmentApplicationSchema.index({ organizationId: 1, source: 1 });
recruitmentApplicationSchema.index({
  organizationId: 1,
  status: 1,
  lastStageChangedAt: 1,
});

export const RecruitmentApplication = mongoose.model<IRecruitmentApplication>(
  "RecruitmentApplication",
  recruitmentApplicationSchema
);
