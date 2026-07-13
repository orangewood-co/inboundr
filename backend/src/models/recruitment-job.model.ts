import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { IRecruitmentStage } from "./recruitment-settings.model";

export const RECRUITMENT_JOB_STATUSES = ["draft", "open", "paused", "closed", "archived"] as const;
export type RecruitmentJobStatus = (typeof RECRUITMENT_JOB_STATUSES)[number];

export interface IRecruitmentJob extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  workplaceType: "onsite" | "hybrid" | "remote" | null;
  description: string;
  requirements: string;
  status: RecruitmentJobStatus;
  stages: IRecruitmentStage[];
  hiringManagerIds: Types.ObjectId[];
  openings: number;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryVisible: boolean;
  publicSlug: string | null;
  seoTitle: string;
  seoDescription: string;
  socialShareText: string;
  publicApplicationForm: Record<string, unknown>;
  aiConfiguration: Record<string, unknown>;
  applicationDeadline: Date | null;
  publishedAt: Date | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const stageSchema = new Schema<IRecruitmentStage>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    order: { type: Number, required: true, min: 0 },
    color: { type: String, default: null, trim: true },
    isTerminal: { type: Boolean, default: false },
    terminalOutcome: { type: String, enum: ["hired", "rejected", null], default: null },
  },
  { _id: false }
);

const recruitmentJobSchema = new Schema<IRecruitmentJob>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, default: "", trim: true, maxlength: 120 },
    location: { type: String, default: "", trim: true, maxlength: 160 },
    employmentType: { type: String, default: "", trim: true, maxlength: 80 },
    workplaceType: { type: String, enum: ["onsite", "hybrid", "remote", null], default: null },
    description: { type: String, default: "", trim: true, maxlength: 50000 },
    requirements: { type: String, default: "", trim: true, maxlength: 50000 },
    status: { type: String, enum: RECRUITMENT_JOB_STATUSES, default: "draft", index: true },
    stages: { type: [stageSchema], required: true },
    hiringManagerIds: { type: [Schema.Types.ObjectId], ref: "Employee", default: [] },
    openings: { type: Number, default: 1, min: 1, max: 10000 },
    salaryMin: { type: Number, default: null, min: 0 },
    salaryMax: { type: Number, default: null, min: 0 },
    salaryCurrency: { type: String, default: "INR", trim: true, uppercase: true, maxlength: 3 },
    salaryVisible: { type: Boolean, default: false },
    publicSlug: { type: String, default: null, trim: true },
    seoTitle: { type: String, default: "", trim: true, maxlength: 120 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 320 },
    socialShareText: { type: String, default: "", trim: true, maxlength: 500 },
    publicApplicationForm: { type: Schema.Types.Mixed, default: () => ({ fields: [] }) },
    aiConfiguration: { type: Schema.Types.Mixed, default: () => ({ enabled: false }) },
    applicationDeadline: { type: Date, default: null, index: true },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdByUserId: { type: String, required: true, index: true },
    updatedByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

recruitmentJobSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
recruitmentJobSchema.index({ organizationId: 1, status: 1, publishedAt: -1 });
recruitmentJobSchema.index(
  { organizationId: 1, publicSlug: 1 },
  { unique: true, partialFilterExpression: { publicSlug: { $type: "string" } } }
);
recruitmentJobSchema.index({ title: "text", department: "text", location: "text" });

export const RecruitmentJob = mongoose.model<IRecruitmentJob>("RecruitmentJob", recruitmentJobSchema);
