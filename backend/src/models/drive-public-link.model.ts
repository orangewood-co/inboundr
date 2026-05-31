import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DrivePublicLinkStatus = "active" | "revoked";

export interface IDrivePublicLink extends Document {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  token: string;
  status: DrivePublicLinkStatus;
  createdByUserId: string;
  expiresAt: Date | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  allowDownload: boolean;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const drivePublicLinkSchema = new Schema<IDrivePublicLink>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    nodeId: {
      type: Schema.Types.ObjectId,
      ref: "DriveNode",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    createdByUserId: { type: String, required: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    passwordHash: { type: String, default: null },
    passwordSalt: { type: String, default: null },
    allowDownload: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0, min: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

drivePublicLinkSchema.index({ token: 1 }, { unique: true });
drivePublicLinkSchema.index({ organizationId: 1, nodeId: 1, status: 1 });
drivePublicLinkSchema.index({ status: 1, expiresAt: 1 });

export const DrivePublicLink = mongoose.model<IDrivePublicLink>(
  "DrivePublicLink",
  drivePublicLinkSchema
);
