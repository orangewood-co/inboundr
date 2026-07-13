import mongoose, { Schema, type Document, type Types } from "mongoose";

export const RECRUITMENT_ACTIVITY_TYPES = [
  "job_created",
  "job_updated",
  "job_status_changed",
  "application_created",
  "application_updated",
  "application_stage_changed",
  "note_added",
  "attachment_added",
] as const;
export type RecruitmentActivityType = (typeof RECRUITMENT_ACTIVITY_TYPES)[number];

export interface IRecruitmentActivity extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId | null;
  candidateId: Types.ObjectId | null;
  applicationId: Types.ObjectId | null;
  type: RecruitmentActivityType;
  actorUserId: string | null;
  actorName: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const recruitmentActivitySchema = new Schema<IRecruitmentActivity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitmentJob", default: null, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitmentCandidate", default: null, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "RecruitmentApplication", default: null, index: true },
    type: { type: String, enum: RECRUITMENT_ACTIVITY_TYPES, required: true },
    actorUserId: { type: String, default: null },
    actorName: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

recruitmentActivitySchema.index({ organizationId: 1, applicationId: 1, createdAt: -1 });
recruitmentActivitySchema.index({ organizationId: 1, jobId: 1, createdAt: -1 });
recruitmentActivitySchema.index({ organizationId: 1, createdAt: -1 });

export const RecruitmentActivity = mongoose.model<IRecruitmentActivity>(
  "RecruitmentActivity",
  recruitmentActivitySchema
);
