import mongoose, { Schema, type Document } from "mongoose";

import type { IFormBranding } from "./form.model";

export interface IFormFolder extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  branding: IFormBranding;
  createdAt: Date;
  updatedAt: Date;
}

const formFolderSchema = new Schema<IFormFolder>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    branding: {
      accentColor: { type: String, default: "#111827" },
      logoUrl: { type: String, default: null },
      backgroundType: {
        type: String,
        enum: ["solid", "gradient", "none"],
        default: "none",
      },
      backgroundColor: { type: String, default: null },
      backgroundGradient: { type: String, default: null },
      theme: { type: String, default: null },
      borderRadius: {
        type: String,
        enum: ["sm", "md", "lg"],
        default: "md",
      },
    },
  },
  { timestamps: true }
);

formFolderSchema.index({ organizationId: 1, name: 1 });

export const FormFolder = mongoose.model<IFormFolder>("FormFolder", formFolderSchema);
