import mongoose, { Schema, type Document } from "mongoose";

export interface IFormSubmission extends Document {
  organizationId: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  values: Record<string, unknown>;
  status: "new" | "reviewed" | "archived";
  source: "link" | "embed";
  metadata: {
    userAgent: string | null;
    referrer: string | null;
    ipHash: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const formSubmissionSchema = new Schema<IFormSubmission>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    formId: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      index: true,
    },
    values: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "archived"],
      default: "new",
      index: true,
    },
    source: {
      type: String,
      enum: ["link", "embed"],
      default: "link",
    },
    metadata: {
      userAgent: { type: String, default: null },
      referrer: { type: String, default: null },
      ipHash: { type: String, default: null },
    },
  },
  { timestamps: true }
);

formSubmissionSchema.index({ formId: 1, createdAt: -1 });
formSubmissionSchema.index({ organizationId: 1, createdAt: -1 });
formSubmissionSchema.index({ formId: 1, status: 1 });

export const FormSubmission = mongoose.model<IFormSubmission>(
  "FormSubmission",
  formSubmissionSchema
);
