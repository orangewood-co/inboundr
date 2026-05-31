import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DriveExportJobStatus = "queued" | "running" | "completed" | "failed";

export interface IDriveExportJob extends Document {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  requestedByUserId: string | null;
  publicLinkId: Types.ObjectId | null;
  status: DriveExportJobStatus;
  archiveKey: string | null;
  archiveName: string;
  totalFiles: number;
  totalBytes: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const driveExportJobSchema = new Schema<IDriveExportJob>(
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
    requestedByUserId: { type: String, default: null, index: true },
    publicLinkId: {
      type: Schema.Types.ObjectId,
      ref: "DrivePublicLink",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    archiveKey: { type: String, default: null, trim: true },
    archiveName: { type: String, required: true, trim: true },
    totalFiles: { type: Number, default: 0, min: 0 },
    totalBytes: { type: Number, default: 0, min: 0 },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

driveExportJobSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
driveExportJobSchema.index({ organizationId: 1, requestedByUserId: 1, createdAt: -1 });

export const DriveExportJob = mongoose.model<IDriveExportJob>(
  "DriveExportJob",
  driveExportJobSchema
);
