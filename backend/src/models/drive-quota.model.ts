import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDriveQuota extends Document {
  organizationId: Types.ObjectId;
  limitBytes: number;
  usedBytes: number;
  reservedBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const driveQuotaSchema = new Schema<IDriveQuota>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    limitBytes: {
      type: Number,
      default: 10 * 1024 * 1024 * 1024,
      min: 0,
    },
    usedBytes: { type: Number, default: 0, min: 0 },
    reservedBytes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const DriveQuota = mongoose.model<IDriveQuota>("DriveQuota", driveQuotaSchema);
