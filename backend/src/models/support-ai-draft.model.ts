import mongoose, { Schema, type Document } from "mongoose";

export type SupportAiDraftStatus = "pending" | "approved" | "rejected";

export interface ISupportAiDraft extends Document {
  ticketId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  bodyText: string;
  status: SupportAiDraftStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  sourceArticleIds: mongoose.Types.ObjectId[];
  sourceTemplateIds: mongoose.Types.ObjectId[];
  modelName: string;
  escalationReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const supportAiDraftSchema = new Schema<ISupportAiDraft>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    bodyText: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedByUserId: { type: String, default: null, index: true },
    approvedByUserId: { type: String, default: null },
    rejectedByUserId: { type: String, default: null },
    sourceArticleIds: { type: [Schema.Types.ObjectId], default: [] },
    sourceTemplateIds: { type: [Schema.Types.ObjectId], default: [] },
    modelName: { type: String, default: "", trim: true },
    escalationReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

supportAiDraftSchema.index({ organizationId: 1, ticketId: 1, status: 1, createdAt: 1 });

export const SupportAiDraft = mongoose.model<ISupportAiDraft>(
  "SupportAiDraft",
  supportAiDraftSchema
);
