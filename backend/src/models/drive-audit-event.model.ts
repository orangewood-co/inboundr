import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DriveAuditAction =
  | "upload_initiated"
  | "upload_completed"
  | "file_imported"
  | "folder_created"
  | "renamed"
  | "moved"
  | "trashed"
  | "restored"
  | "deleted"
  | "shared"
  | "unshared"
  | "public_link_created"
  | "public_link_revoked"
  | "public_link_emailed"
  | "public_link_accessed"
  | "downloaded"
  | "export_requested"
  | "export_completed"
  | "chat_context_enabled"
  | "chat_context_disabled";

export interface IDriveAuditEvent extends Document {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId | null;
  actorUserId: string | null;
  action: DriveAuditAction;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const driveAuditEventSchema = new Schema<IDriveAuditEvent>(
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
      default: null,
      index: true,
    },
    actorUserId: { type: String, default: null, index: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

driveAuditEventSchema.index({ organizationId: 1, createdAt: -1 });
driveAuditEventSchema.index({ organizationId: 1, nodeId: 1, createdAt: -1 });

export const DriveAuditEvent = mongoose.model<IDriveAuditEvent>(
  "DriveAuditEvent",
  driveAuditEventSchema
);
