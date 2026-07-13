import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentNote extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  applicationId: Types.ObjectId;
  candidateId: Types.ObjectId;
  body: string;
  visibility: "internal";
  authorUserId: string;
  authorName: string;
  createdAt: Date;
}

const recruitmentNoteSchema = new Schema<IRecruitmentNote>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "RecruitmentApplication", required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "RecruitmentCandidate", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    visibility: { type: String, enum: ["internal"], default: "internal" },
    authorUserId: { type: String, required: true },
    authorName: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

recruitmentNoteSchema.index({ organizationId: 1, applicationId: 1, createdAt: -1 });

export const RecruitmentNote = mongoose.model<IRecruitmentNote>("RecruitmentNote", recruitmentNoteSchema);
