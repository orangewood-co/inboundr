import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DriveNodeType = "file" | "folder";
export type DriveNodeStatus = "active" | "trashed" | "deleted";
export type DriveScanStatus = "not_scanned" | "pending" | "clean" | "infected" | "failed";

export interface IDriveNode extends Document {
  organizationId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  type: DriveNodeType;
  name: string;
  normalizedName: string;
  storageKey: string | null;
  bucket: string | null;
  contentType: string | null;
  size: number;
  ownerUserId: string;
  createdByUserId: string;
  updatedByUserId: string | null;
  status: DriveNodeStatus;
  trashedAt: Date | null;
  trashedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  scanStatus: DriveScanStatus;
  upload: {
    status: "none" | "initiated" | "completed" | "aborted";
    uploadId: string | null;
    partSize: number | null;
    partCount: number | null;
    completedAt: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

const driveNodeSchema = new Schema<IDriveNode>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "DriveNode",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["file", "folder"],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    storageKey: { type: String, default: null, trim: true },
    bucket: { type: String, default: null, trim: true },
    contentType: { type: String, default: null, trim: true, index: true },
    size: { type: Number, default: 0, min: 0 },
    ownerUserId: { type: String, required: true, index: true },
    createdByUserId: { type: String, required: true, index: true },
    updatedByUserId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["active", "trashed", "deleted"],
      default: "active",
      index: true,
    },
    trashedAt: { type: Date, default: null, index: true },
    trashedByUserId: { type: String, default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedByUserId: { type: String, default: null },
    scanStatus: {
      type: String,
      enum: ["not_scanned", "pending", "clean", "infected", "failed"],
      default: "not_scanned",
      index: true,
    },
    upload: {
      status: {
        type: String,
        enum: ["none", "initiated", "completed", "aborted"],
        default: "none",
      },
      uploadId: { type: String, default: null },
      partSize: { type: Number, default: null, min: 1 },
      partCount: { type: Number, default: null, min: 1 },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

driveNodeSchema.pre("validate", function setNormalizedName() {
  this.normalizedName = normalizeName(this.name);
});

driveNodeSchema.index({ organizationId: 1, parentId: 1, status: 1, type: 1, updatedAt: -1 });
driveNodeSchema.index({ organizationId: 1, ownerUserId: 1, status: 1, updatedAt: -1 });
driveNodeSchema.index({ organizationId: 1, normalizedName: "text", contentType: "text" });
driveNodeSchema.index({ storageKey: 1 }, { sparse: true });

export const DriveNode = mongoose.model<IDriveNode>("DriveNode", driveNodeSchema);
