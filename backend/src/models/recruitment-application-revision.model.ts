import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentApplicationRevision extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  applicationId: Types.ObjectId;
  revision: number;
  reason: string;
  actorUserId: string | null;
  snapshot: Record<string, unknown>;
  createdAt: Date;
}

const recruitmentApplicationRevisionSchema = new Schema<IRecruitmentApplicationRevision>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "RecruitmentApplication", required: true, index: true },
    revision: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    actorUserId: { type: String, default: null },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

recruitmentApplicationRevisionSchema.index(
  { organizationId: 1, applicationId: 1, revision: 1 },
  { unique: true }
);

export const RecruitmentApplicationRevision = mongoose.model<IRecruitmentApplicationRevision>(
  "RecruitmentApplicationRevision",
  recruitmentApplicationRevisionSchema
);
