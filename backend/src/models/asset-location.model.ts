import mongoose, { Schema, type Document, type Types } from "mongoose";

export type AssetLocationStatus = "active" | "archived";

export interface IAssetLocation extends Document {
  organizationId: Types.ObjectId;
  name: string;
  address: string;
  notes: string;
  status: AssetLocationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const assetLocationSchema = new Schema<IAssetLocation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

assetLocationSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export const AssetLocation = mongoose.model<IAssetLocation>(
  "AssetLocation",
  assetLocationSchema
);
