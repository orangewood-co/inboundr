import mongoose, { Schema, type Document } from "mongoose";

export interface ISupportTemplate extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  shortcut: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportTemplateSchema = new Schema<ISupportTemplate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    shortcut: { type: String, default: "", trim: true, maxlength: 40 },
    createdBy: { type: String, default: null },
  },
  { timestamps: true }
);

supportTemplateSchema.index({ organizationId: 1, updatedAt: -1 });

export const SupportTemplate = mongoose.model<ISupportTemplate>(
  "SupportTemplate",
  supportTemplateSchema
);
