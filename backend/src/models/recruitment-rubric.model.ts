import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRecruitmentRubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
}

export interface IRecruitmentRubric extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  version: number;
  status: "draft" | "approved" | "superseded";
  criteria: IRecruitmentRubricCriterion[];
  instructions: string;
  modelName: string;
  promptVersion: string;
  generatedAt: Date | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const criterionSchema = new Schema<IRecruitmentRubricCriterion>(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    weight: { type: Number, required: true, min: 0, max: 100 },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const schema = new Schema<IRecruitmentRubric>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "RecruitmentJob", required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["draft", "approved", "superseded"],
      default: "draft",
      index: true,
    },
    criteria: { type: [criterionSchema], required: true },
    instructions: { type: String, default: "", trim: true, maxlength: 5000 },
    modelName: { type: String, required: true, trim: true },
    promptVersion: { type: String, required: true, trim: true },
    generatedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedByUserId: { type: String, default: null },
    createdByUserId: { type: String, required: true },
    updatedByUserId: { type: String, required: true },
  },
  { timestamps: true }
);

schema.index({ organizationId: 1, jobId: 1, version: 1 }, { unique: true });
schema.index(
  { organizationId: 1, jobId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "approved" } }
);

export const RecruitmentRubric = mongoose.model<IRecruitmentRubric>(
  "RecruitmentRubric",
  schema
);
