import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentStage {
  id: string;
  name: string;
  order: number;
  color: string | null;
  isTerminal: boolean;
  terminalOutcome: "hired" | "rejected" | null;
}

export interface IRecruitmentSocialLink {
  label: string;
  url: string;
}

export interface IRecruitmentBranding {
  primaryColor: string;
  logoUrl: string | null;
}

export interface IRecruitmentBanner {
  key: string;
  bucket: string;
  originalName: string;
  contentType: string;
  size: number;
  url: string | null;
  uploadedAt: Date;
}

export interface IRecruitmentSettings extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  organizationPath: string | null;
  headline: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
  socialShareText: string;
  bannerUrl: string | null;
  banner: IRecruitmentBanner | null;
  socialLinks: IRecruitmentSocialLink[];
  privacyPolicyUrl: string | null;
  inheritOrganizationBranding: boolean;
  branding: IRecruitmentBranding;
  consent: {
    version: string;
    text: string;
  };
  defaultStages: IRecruitmentStage[];
  defaultApplicationForm: Record<string, unknown>;
  publicCareersEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_RECRUITMENT_STAGES: IRecruitmentStage[] = [
  { id: "applied", name: "Applied", order: 0, color: "#64748b", isTerminal: false, terminalOutcome: null },
  { id: "screening", name: "Screening", order: 1, color: "#3b82f6", isTerminal: false, terminalOutcome: null },
  { id: "interview", name: "Interview", order: 2, color: "#8b5cf6", isTerminal: false, terminalOutcome: null },
  { id: "offer", name: "Offer", order: 3, color: "#f59e0b", isTerminal: false, terminalOutcome: null },
  { id: "hired", name: "Hired", order: 4, color: "#10b981", isTerminal: true, terminalOutcome: "hired" },
  { id: "rejected", name: "Rejected", order: 5, color: "#ef4444", isTerminal: true, terminalOutcome: "rejected" },
];

const recruitmentStageSchema = new Schema<IRecruitmentStage>(
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

const recruitmentBannerSchema = new Schema<IRecruitmentBanner>(
  {
    key: { type: String, required: true, trim: true },
    bucket: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true, maxlength: 200 },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    url: { type: String, default: null, trim: true, maxlength: 2000 },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const recruitmentSettingsSchema = new Schema<IRecruitmentSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    organizationPath: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 72,
    },
    headline: { type: String, default: "", trim: true, maxlength: 240 },
    intro: { type: String, default: "", trim: true, maxlength: 5000 },
    seoTitle: { type: String, default: "", trim: true, maxlength: 120 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 320 },
    socialShareText: { type: String, default: "", trim: true, maxlength: 500 },
    bannerUrl: { type: String, default: null, trim: true, maxlength: 2000 },
    banner: { type: recruitmentBannerSchema, default: null },
    socialLinks: {
      type: [
        {
          label: { type: String, required: true, trim: true, maxlength: 80 },
          url: { type: String, required: true, trim: true, maxlength: 2000 },
        },
      ],
      default: [],
    },
    privacyPolicyUrl: { type: String, default: null, trim: true, maxlength: 2000 },
    inheritOrganizationBranding: { type: Boolean, default: true },
    branding: {
      primaryColor: { type: String, default: "#f5b400", trim: true, maxlength: 32 },
      logoUrl: { type: String, default: null, trim: true, maxlength: 2000 },
    },
    consent: {
      version: { type: String, default: "", trim: true, maxlength: 80 },
      text: { type: String, default: "", trim: true, maxlength: 5000 },
    },
    defaultStages: { type: [recruitmentStageSchema], default: () => DEFAULT_RECRUITMENT_STAGES },
    defaultApplicationForm: { type: Schema.Types.Mixed, default: () => ({ fields: [] }) },
    publicCareersEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

recruitmentSettingsSchema.index(
  { organizationPath: 1 },
  { unique: true, partialFilterExpression: { organizationPath: { $type: "string" } } }
);

export const RecruitmentSettings = mongoose.model<IRecruitmentSettings>(
  "RecruitmentSettings",
  recruitmentSettingsSchema
);
