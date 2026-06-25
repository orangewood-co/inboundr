import type { Types } from "mongoose";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import { commitReservedDriveBytes, releaseReservedDriveBytes, reserveDriveBytes } from "./drive-quota.service";
import { recordDriveAuditEvent } from "./drive-audit.service";
import { indexNode, isNodeInChatContext } from "./drive-knowledge.service";
import { copyObject, createUploadKey, deleteObject, storageBucket } from "./storage.service";

const MAX_DRIVE_FILE_SIZE = 1024 * 1024 * 1024;

export async function importExistingObjectToDrive(input: {
  organizationId: Types.ObjectId;
  userId: string;
  sourceKey: string;
  parentId: Types.ObjectId | null;
  fileName: string;
  contentType: string;
  size: number;
  auditMetadata?: Record<string, unknown>;
}): Promise<IDriveNode> {
  const fileName = input.fileName.trim().replace(/\s+/g, " ").slice(0, 240) || "Uploaded file";
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new Error("File size is required");
  }
  if (input.size > MAX_DRIVE_FILE_SIZE) {
    throw new Error("Drive files must be 1GB or smaller");
  }

  await reserveDriveBytes(input.organizationId, input.size);

  const destinationKey = createUploadKey({
    scope: "drive",
    organizationId: String(input.organizationId),
    fileName,
    contentType: input.contentType,
    size: input.size,
    prefixParts: input.parentId ? [String(input.parentId)] : [],
  });

  let copied = false;
  let node: IDriveNode | null = null;

  try {
    await copyObject({
      sourceKey: input.sourceKey,
      destinationKey,
      contentType: input.contentType,
    });
    copied = true;

    node = await DriveNode.create({
      organizationId: input.organizationId,
      parentId: input.parentId,
      type: "file",
      name: fileName,
      storageKey: destinationKey,
      bucket: storageBucket(),
      contentType: input.contentType,
      size: input.size,
      ownerUserId: input.userId,
      createdByUserId: input.userId,
      updatedByUserId: input.userId,
      upload: {
        status: "completed",
        uploadId: null,
        partSize: null,
        partCount: null,
        completedAt: new Date(),
      },
    });

    await commitReservedDriveBytes(input.organizationId, input.size);

    const importedNode = node;
    void (async () => {
      try {
        if (await isNodeInChatContext(importedNode)) {
          await indexNode(importedNode);
        }
      } catch (indexErr) {
        console.error(
          `Background indexing failed for imported node ${String(importedNode._id)}:`,
          indexErr
        );
      }
    })();

    recordDriveAuditEvent({
      organizationId: input.organizationId,
      nodeId: node._id,
      actorUserId: input.userId,
      action: "file_imported",
      metadata: {
        sourceKey: input.sourceKey,
        destinationKey,
        ...input.auditMetadata,
      },
    });

    return node;
  } catch (err) {
    await releaseReservedDriveBytes(input.organizationId, input.size).catch((releaseErr) => {
      console.error("Failed to release Drive quota after import failure:", releaseErr);
    });
    if (node) {
      await DriveNode.deleteOne({ _id: node._id }).catch((deleteErr) => {
        console.error("Failed to remove Drive node after import failure:", deleteErr);
      });
    }
    if (copied) {
      await deleteObject(destinationKey).catch((deleteErr) => {
        console.error("Failed to remove copied Drive object after import failure:", deleteErr);
      });
    }
    throw err;
  }
}
