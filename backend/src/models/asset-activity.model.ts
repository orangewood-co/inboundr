import mongoose, { Schema, type Document, type Types } from "mongoose";

export const ASSET_ACTIVITY_TYPES = [
  "created",
  "activated",
  "edited",
  "assigned",
  "moved",
  "condition_changed",
  "repaired",
  "adjusted",
  "disposed",
] as const;

export type AssetActivityType = (typeof ASSET_ACTIVITY_TYPES)[number];

export interface IAssetActivity extends Document {
  organizationId: Types.ObjectId;
  assetId: Types.ObjectId;
  type: AssetActivityType;
  actorUserId: string | null;
  actorName: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const assetActivitySchema = new Schema<IAssetActivity>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ASSET_ACTIVITY_TYPES,
      required: true,
    },
    actorUserId: { type: String, default: null },
    actorName: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
    payload: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

assetActivitySchema.index({ assetId: 1, createdAt: -1 });

export const AssetActivity = mongoose.model<IAssetActivity>(
  "AssetActivity",
  assetActivitySchema
);
