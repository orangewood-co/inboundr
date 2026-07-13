import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentAttachment extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  applicationId: Types.ObjectId | null;
  kind: "resume" | "cover_letter" | "portfolio" | "other";
  key: string;
  bucket: string;
  originalName: string;
  contentType: string;
  size: number;
  isPrivate: true;
  uploadedByUserId: string | null;
  createdAt: Date;
}

const recruitmentAttachmentSchema = new Schema<IRecruitmentAttachment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitmentCandidate", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "RecruitmentApplication", default: null, index: true },
    kind: { type: String, enum: ["resume", "cover_letter", "portfolio", "other"], default: "other" },
    key: { type: String, required: true, trim: true },
    bucket: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    isPrivate: { type: Boolean, default: true, immutable: true },
    uploadedByUserId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

recruitmentAttachmentSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });
recruitmentAttachmentSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export const RecruitmentAttachment = mongoose.model<IRecruitmentAttachment>(
  "RecruitmentAttachment",
  recruitmentAttachmentSchema
);
