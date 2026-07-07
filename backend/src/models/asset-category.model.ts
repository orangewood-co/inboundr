import mongoose, { Schema, type Document, type Types } from "mongoose";

export const ASSET_DEPRECIATION_METHODS = [
  "straight_line",
  "written_down_value",
] as const;

export type AssetDepreciationMethod =
  (typeof ASSET_DEPRECIATION_METHODS)[number];
export type AssetCategoryStatus = "active" | "archived";

export interface IAssetCategory extends Document {
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  depreciationMethod: AssetDepreciationMethod;
  usefulLifeMonths: number;
  /** Salvage value as a percentage of purchase cost (straight line floor / WDV floor). */
  salvagePercentage: number;
  /** Yearly depreciation rate applied to opening book value (written down value only). */
  wdvRatePercentage: number;
  status: AssetCategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const assetCategorySchema = new Schema<IAssetCategory>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    depreciationMethod: {
      type: String,
      enum: ASSET_DEPRECIATION_METHODS,
      default: "straight_line",
    },
    usefulLifeMonths: { type: Number, default: 60, min: 1 },
    salvagePercentage: { type: Number, default: 0, min: 0, max: 95 },
    wdvRatePercentage: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

assetCategorySchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export const AssetCategory = mongoose.model<IAssetCategory>(
  "AssetCategory",
  assetCategorySchema
);
