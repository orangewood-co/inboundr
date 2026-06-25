import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DriveDocumentIndexStatus =
  | "pending"
  | "indexed"
  | "failed"
  | "unsupported";

export interface IDriveDocumentIndex extends Document {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  status: DriveDocumentIndexStatus;
  chunkCount: number;
  contentHash: string | null;
  error: string | null;
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const driveDocumentIndexSchema = new Schema<IDriveDocumentIndex>(
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
      unique: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "DriveNode",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "indexed", "failed", "unsupported"],
      default: "pending",
      index: true,
    },
    chunkCount: { type: Number, default: 0, min: 0 },
    contentHash: { type: String, default: null },
    error: { type: String, default: null },
    indexedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

driveDocumentIndexSchema.index({ organizationId: 1, status: 1 });

export const DriveDocumentIndex = mongoose.model<IDriveDocumentIndex>(
  "DriveDocumentIndex",
  driveDocumentIndexSchema
);
