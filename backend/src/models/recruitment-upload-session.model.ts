import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentUploadSession extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  tokenHash: string;
  ipHash: string;
  uploadCount: number;
  maxUploads: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<IRecruitmentUploadSession>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentJob",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    ipHash: { type: String, required: true },
    uploadCount: { type: Number, default: 0, min: 0 },
    maxUploads: { type: Number, default: 12, min: 1, max: 25 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RecruitmentUploadSession = mongoose.model<IRecruitmentUploadSession>(
  "RecruitmentUploadSession",
  schema
);
