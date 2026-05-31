import type { Types } from "mongoose";
import { DriveAuditEvent, type DriveAuditAction } from "../models/drive-audit-event.model";

export function recordDriveAuditEvent(input: {
  organizationId: Types.ObjectId;
  nodeId?: Types.ObjectId | null;
  actorUserId?: string | null;
  action: DriveAuditAction;
  metadata?: Record<string, unknown>;
}) {
  void DriveAuditEvent.create({
    organizationId: input.organizationId,
    nodeId: input.nodeId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
  }).catch((err) => {
    console.error("Failed to record Drive audit event:", err);
  });
}
