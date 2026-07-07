import mongoose, { Schema, type Document, type Types } from "mongoose";

export const DEFAULT_ASSET_CODE_PREFIX = "AST";

export interface IAssetSettings extends Document {
  organizationId: Types.ObjectId;
  codePrefix: string;
  nextSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetSettingsSchema = new Schema<IAssetSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    codePrefix: {
      type: String,
      default: DEFAULT_ASSET_CODE_PREFIX,
      trim: true,
      uppercase: true,
      maxlength: 8,
    },
    nextSequence: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

export const AssetSettings = mongoose.model<IAssetSettings>(
  "AssetSettings",
  assetSettingsSchema
);
