import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentCandidate extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  currentCompany: string;
  links: Array<{ label: string; url: string }>;
  skills: string[];
  tags: string[];
  source: string;
  consent: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const linkSchema = new Schema(
  {
    label: { type: String, default: "", trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const recruitmentCandidateSchema = new Schema<IRecruitmentCandidate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    location: { type: String, default: "", trim: true, maxlength: 160 },
    headline: { type: String, default: "", trim: true, maxlength: 240 },
    currentCompany: { type: String, default: "", trim: true, maxlength: 160 },
    links: { type: [linkSchema], default: [] },
    skills: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    source: { type: String, default: "manual", trim: true, maxlength: 80 },
    consent: { type: Schema.Types.Mixed, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    createdByUserId: { type: String, default: null, index: true },
    updatedByUserId: { type: String, default: null },
  },
  { timestamps: true }
);

recruitmentCandidateSchema.index({ organizationId: 1, email: 1 }, { unique: true });
recruitmentCandidateSchema.index({ organizationId: 1, updatedAt: -1 });
recruitmentCandidateSchema.index({ fullName: "text", email: "text", headline: "text", skills: "text" });

export const RecruitmentCandidate = mongoose.model<IRecruitmentCandidate>(
  "RecruitmentCandidate",
  recruitmentCandidateSchema
);
