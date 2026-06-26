import mongoose, { Schema, type Document } from "mongoose";

export type OrgPhoneNumberStatus = "active" | "disabled";

export interface IOrgPhoneNumber extends Document {
  organizationId: mongoose.Types.ObjectId;
  /** Dialed number in E.164 form, e.g. +918046733659. */
  phoneNumber: string;
  /** Optional Vobiz number identifier for future API-driven provisioning. */
  vobizNumberId: string | null;
  label: string;
  status: OrgPhoneNumberStatus;
  /** Platform admin user id that assigned this number. */
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const orgPhoneNumberSchema = new Schema<IOrgPhoneNumber>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    vobizNumberId: { type: String, default: null, trim: true },
    label: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    createdBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const OrgPhoneNumber = mongoose.model<IOrgPhoneNumber>(
  "OrgPhoneNumber",
  orgPhoneNumberSchema
);
