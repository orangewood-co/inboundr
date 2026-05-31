import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DrivePermissionRole = "viewer" | "editor";
export type DrivePermissionSource = "direct" | "inherited";

export interface IDrivePermission extends Document {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  targetUserId: string;
  role: DrivePermissionRole;
  source: DrivePermissionSource;
  grantedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const drivePermissionSchema = new Schema<IDrivePermission>(
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
    targetUserId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["viewer", "editor"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["direct", "inherited"],
      default: "direct",
      index: true,
    },
    grantedByUserId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

drivePermissionSchema.index(
  { organizationId: 1, nodeId: 1, targetUserId: 1 },
  { unique: true }
);
drivePermissionSchema.index({ organizationId: 1, targetUserId: 1, updatedAt: -1 });

export const DrivePermission = mongoose.model<IDrivePermission>(
  "DrivePermission",
  drivePermissionSchema
);
