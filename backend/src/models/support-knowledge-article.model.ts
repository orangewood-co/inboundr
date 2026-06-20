import mongoose, { Schema, type Document } from "mongoose";

export interface ISupportKnowledgeArticle extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  tags: string[];
  enabled: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportKnowledgeArticleSchema = new Schema<ISupportKnowledgeArticle>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 12000 },
    tags: { type: [String], default: [] },
    enabled: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

supportKnowledgeArticleSchema.index({ organizationId: 1, enabled: 1, updatedAt: -1 });
supportKnowledgeArticleSchema.index({ title: "text", body: "text", tags: "text" });

export const SupportKnowledgeArticle = mongoose.model<ISupportKnowledgeArticle>(
  "SupportKnowledgeArticle",
  supportKnowledgeArticleSchema
);
