import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IProcurementSettings extends Document {
  organizationId: Types.ObjectId;
  /** Free-text guidance for the procurement agent: what the org sources, from whom, and what it never buys. */
  instructions: string;
  /** Indian states whose suppliers get a ranking boost. Empty means no preference. */
  preferredStates: string[];
  /** Requests containing any of these terms are rejected before searching. */
  excludedKeywords: string[];
  requireGstRegistered: boolean;
  requireVerifiedSupplier: boolean;
  defaultMarginPercent: number;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const procurementSettingsSchema = new Schema<IProcurementSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    instructions: { type: String, default: "", trim: true, maxlength: 4000 },
    preferredStates: { type: [String], default: [] },
    excludedKeywords: { type: [String], default: [] },
    requireGstRegistered: { type: Boolean, default: true },
    requireVerifiedSupplier: { type: Boolean, default: false },
    defaultMarginPercent: { type: Number, default: 15, min: 0, max: 500 },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const ProcurementSettings = mongoose.model<IProcurementSettings>(
  "ProcurementSettings",
  procurementSettingsSchema
);
