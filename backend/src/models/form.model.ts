import mongoose, { Schema, type Document } from "mongoose";

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "checkbox"
  | "date"
  | "file";

export interface IFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string | null;
  options?: string[];
  maxFileSizeMb?: number;
  allowedMimeTypes?: string[];
  multiple?: boolean;
}

export interface IForm extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  fields: IFormField[];
  branding: {
    accentColor: string;
    logoUrl: string | null;
    backgroundType: "solid" | "gradient" | "none";
    backgroundColor: string | null;
    backgroundGradient: string | null;
    theme: string | null;
    borderRadius: "sm" | "md" | "lg";
  };
  settings: {
    submitButtonLabel: string;
    successMessage: string;
    notifyOnSubmission: boolean;
    collectDeviceInfo: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const formFieldSchema = new Schema<IFormField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["short_text", "long_text", "email", "phone", "number", "dropdown", "checkbox", "date", "file"],
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: null },
    options: { type: [String], default: [] },
    maxFileSizeMb: { type: Number, default: 10 },
    allowedMimeTypes: { type: [String], default: [] },
    multiple: { type: Boolean, default: false },
  },
  { _id: false }
);

const formSchema = new Schema<IForm>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    slug: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    fields: { type: [formFieldSchema], default: [] },
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
    settings: {
      submitButtonLabel: { type: String, default: "Submit" },
      successMessage: { type: String, default: "Thanks. Your response has been submitted." },
      notifyOnSubmission: { type: Boolean, default: true },
      collectDeviceInfo: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

formSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
formSchema.index({ slug: 1, status: 1 });
formSchema.index({ organizationId: 1, updatedAt: -1 });

export const Form = mongoose.model<IForm>("Form", formSchema);
