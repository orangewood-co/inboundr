import type { Types } from "mongoose";
import { DriveExportJob, type IDriveExportJob } from "../models/drive-export-job.model";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import { createUploadKey, getObjectBuffer, putObjectBuffer } from "./storage.service";
import { recordDriveAuditEvent } from "./drive-audit.service";

const archiver: typeof import("archiver") = require("archiver");

function safeArchiveName(value: string): string {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "drive-export"
  );
}

async function collectArchiveBuffer(files: Array<{ node: IDriveNode; path: string }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      try {
        for (const file of files) {
          if (!file.node.storageKey) continue;
          const body = await getObjectBuffer(file.node.storageKey);
          archive.append(body, { name: file.path });
        }
        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

async function collectFolderFiles(input: {
  organizationId: Types.ObjectId;
  root: IDriveNode;
}): Promise<Array<{ node: IDriveNode; path: string }>> {
  const files: Array<{ node: IDriveNode; path: string }> = [];
  const queue: Array<{ parentId: Types.ObjectId; path: string }> = [
    { parentId: input.root._id, path: safeArchiveName(input.root.name) },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    const children = await DriveNode.find({
      organizationId: input.organizationId,
      parentId: current.parentId,
      status: "active",
    }).sort({ type: 1, name: 1 });

    for (const child of children) {
      const childPath = `${current.path}/${safeArchiveName(child.name)}`;
      if (child.type === "folder") {
        queue.push({ parentId: child._id, path: childPath });
      } else {
        files.push({ node: child, path: childPath });
      }
    }
  }

  return files;
}

export async function createDriveExportJob(input: {
  organizationId: Types.ObjectId;
  node: IDriveNode;
  requestedByUserId?: string | null;
  publicLinkId?: Types.ObjectId | null;
}): Promise<IDriveExportJob> {
  const archiveName = `${safeArchiveName(input.node.name)}.zip`;
  const job = await DriveExportJob.create({
    organizationId: input.organizationId,
    nodeId: input.node._id,
    requestedByUserId: input.requestedByUserId ?? null,
    publicLinkId: input.publicLinkId ?? null,
    archiveName,
  });

  recordDriveAuditEvent({
    organizationId: input.organizationId,
    nodeId: input.node._id,
    actorUserId: input.requestedByUserId ?? null,
    action: "export_requested",
    metadata: { jobId: String(job._id) },
  });

  void processDriveExportJob(job._id).catch((err) => {
    console.error("Drive export job failed:", err);
  });

  return job;
}

export async function processDriveExportJob(jobId: Types.ObjectId): Promise<void> {
  const job = await DriveExportJob.findByIdAndUpdate(
    jobId,
    { status: "running", startedAt: new Date(), error: null },
    { new: true }
  );
  if (!job) return;

  try {
    const root = await DriveNode.findOne({
      _id: job.nodeId,
      organizationId: job.organizationId,
      type: "folder",
      status: "active",
    });
    if (!root) throw new Error("Folder not found");

    const files = await collectFolderFiles({ organizationId: job.organizationId, root });
    const totalBytes = files.reduce((sum, file) => sum + file.node.size, 0);
    const archiveBuffer = await collectArchiveBuffer(files);
    const archiveKey = createUploadKey({
      scope: "drive-export",
      organizationId: String(job.organizationId),
      fileName: job.archiveName,
      contentType: "application/zip",
      size: archiveBuffer.length,
      prefixParts: [String(job._id)],
    });

    await putObjectBuffer({
      key: archiveKey,
      body: archiveBuffer,
      contentType: "application/zip",
    });

    await DriveExportJob.updateOne(
      { _id: job._id },
      {
        status: "completed",
        archiveKey,
        totalFiles: files.length,
        totalBytes,
        completedAt: new Date(),
      }
    );

    recordDriveAuditEvent({
      organizationId: job.organizationId,
      nodeId: job.nodeId,
      actorUserId: job.requestedByUserId,
      action: "export_completed",
      metadata: { jobId: String(job._id), totalFiles: files.length, totalBytes },
    });
  } catch (err: any) {
    await DriveExportJob.updateOne(
      { _id: job._id },
      {
        status: "failed",
        error: err?.message || "Export failed",
        completedAt: new Date(),
      }
    );
  }
}
