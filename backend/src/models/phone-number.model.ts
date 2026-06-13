import mongoose, { Schema, type Document } from "mongoose";

/**
 * A platform-owned Vobiz phone number assigned to an organization.
 * Inbound calls are mapped to an organization by the dialed number.
 */
export interface IPhoneNumber extends Document {
  number: string;
  organizationId: mongoose.Types.ObjectId;
  label: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const phoneNumberSchema = new Schema<IPhoneNumber>(
  {
    number: { type: String, required: true, unique: true, trim: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    label: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PhoneNumber = mongoose.model<IPhoneNumber>("PhoneNumber", phoneNumberSchema);
