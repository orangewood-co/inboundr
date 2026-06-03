import crypto from "crypto";
import type { Request, Response } from "express";
import mongoose, { type Types } from "mongoose";
import { frontendOrigin } from "../config/origins.config";
import { DriveExportJob } from "../models/drive-export-job.model";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import { DrivePermission, type DrivePermissionRole } from "../models/drive-permission.model";
import { DrivePublicLink, type IDrivePublicLink } from "../models/drive-public-link.model";
import { OrganizationMember } from "../models/organization-member.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  createPresignedUploadPartUrl,
  createPresignedViewUrl,
  deleteObject,
  getObjectBuffer,
} from "../services/storage.service";
import { suggestFileName } from "../lib/ai-chat";
import { createDriveExportJob } from "../services/drive-export.service";
import { recordDriveAuditEvent } from "../services/drive-audit.service";
import {
  assertDriveAccess,
  canManageDriveSharing,
  canRoleView,
  getDriveDescendantIds,
  getEffectiveDriveRole,
  isDescendantOf,
  isOrgDriveAdmin,
  requireDriveNode,
} from "../services/drive-access.service";
import {
  commitReservedDriveBytes,
  getOrCreateDriveQuota,
  releaseReservedDriveBytes,
  releaseUsedDriveBytes,
  reserveDriveBytes,
} from "../services/drive-quota.service";
import { hashPassword, verifyPassword } from "../services/short-link.service";

const MAX_DRIVE_FILE_SIZE = 1024 * 1024 * 1024;
const MULTIPART_PART_SIZE = 10 * 1024 * 1024;

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNodeName(value: unknown): string {
  return stringValue(value).replace(/\s+/g, " ").slice(0, 240);
}

function objectId(value: unknown): Types.ObjectId | null {
  const raw = stringValue(value);
  return raw && mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
}

function paramValue(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function publicShareUrl(token: string): string {
  return `${frontendOrigin}/drive/share/${encodeURIComponent(token)}`;
}

function defaultPublicLinkExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function parseExpiry(value: unknown): Date | null {
  if (value === null || value === "") return null;
  if (value === undefined) return defaultPublicLinkExpiry();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? defaultPublicLinkExpiry() : date;
}

function serializeNode(node: any, role?: string) {
  return {
    _id: String(node._id),
    organizationId: String(node.organizationId),
    parentId: node.parentId ? String(node.parentId) : null,
    type: node.type,
    name: node.name,
    storageKey: node.storageKey,
    contentType: node.contentType,
    size: node.size,
    ownerUserId: node.ownerUserId,
    createdByUserId: node.createdByUserId,
    status: node.status,
    trashedAt: node.trashedAt,
    scanStatus: node.scanStatus,
    upload: node.upload,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    role,
  };
}

function serializePublicLink(link: any) {
  return {
    _id: String(link._id),
    nodeId: String(link.nodeId),
    token: link.token,
    status: link.status,
    expiresAt: link.expiresAt,
    allowDownload: link.allowDownload,
    hasPassword: Boolean(link.passwordHash),
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt,
    shareUrl: publicShareUrl(link.token),
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

async function serializeNodeForUser(node: IDriveNode, req: OrganizationRequest) {
  const role = await getEffectiveDriveRole({
    node,
    userId: req.user.id,
    organizationRole: req.organizationMembership.role,
  });
  return serializeNode(node.toObject(), role);
}

async function filterAccessible(nodes: IDriveNode[], req: OrganizationRequest) {
  const items = [];
  for (const node of nodes) {
    const role = await getEffectiveDriveRole({
      node,
      userId: req.user.id,
      organizationRole: req.organizationMembership.role,
    });
    if (canRoleView(role)) items.push(serializeNode(node.toObject(), role));
  }
  return items;
}

async function resolveUserByEmail(email: string): Promise<{ id: string; name?: string; email?: string } | null> {
  const db = mongoose.connection.db;
  if (!db) return null;
  const user = await db
    .collection("user")
    .findOne({ email: email.toLowerCase() }, { projection: { id: 1, name: 1, email: 1 } });
  if (!user?.id) return null;
  return { id: String(user.id), name: user.name, email: user.email };
}

async function resolveUsersByIds(userIds: string[]) {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) return new Map<string, { name?: string; email?: string }>();
  const users = await db
    .collection("user")
    .find({ id: { $in: userIds } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();
  return new Map(users.map((user) => [String(user.id), { name: user.name, email: user.email }]));
}

async function validateParentAccess(req: OrganizationRequest, parentId: Types.ObjectId | null) {
  if (!parentId) return null;
  const parent = await DriveNode.findOne({
    _id: parentId,
    organizationId: req.organization._id,
    type: "folder",
    status: "active",
  });
  if (!parent) throw new Error("Parent folder not found");
  await assertDriveAccess({
    node: parent,
    userId: req.user.id,
    organizationRole: req.organizationMembership.role,
    minimumRole: "editor",
  });
  return parent;
}

async function validatePublicLink(token: string, password?: string): Promise<{
  link: IDrivePublicLink;
  root: IDriveNode;
  locked: boolean;
}> {
  const link = await DrivePublicLink.findOne({ token, status: "active" });
  if (!link || (link.expiresAt && link.expiresAt.getTime() <= Date.now())) {
    throw new Error("Share link not found");
  }
  const root = await DriveNode.findOne({
    _id: link.nodeId,
    organizationId: link.organizationId,
    status: "active",
  });
  if (!root) throw new Error("Shared item not found");

  if (link.passwordHash && link.passwordSalt) {
    const ok = password ? verifyPassword(password, link.passwordSalt, link.passwordHash) : false;
    if (!ok) return { link, root, locked: true };
  }

  return { link, root, locked: false };
}

async function requirePublicNode(input: {
  link: IDrivePublicLink;
  root: IDriveNode;
  nodeId?: string;
}): Promise<IDriveNode> {
  if (!input.nodeId || String(input.root._id) === input.nodeId) return input.root;
  const node = await requireDriveNode({
    organizationId: input.link.organizationId,
    nodeId: input.nodeId,
  });
  const isAllowed = await isDescendantOf({
    organizationId: input.link.organizationId,
    nodeId: node._id,
    possibleAncestorId: input.root._id,
  });
  if (!isAllowed) throw new Error("Shared item not found");
  return node;
}

export async function listDriveNodes(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const view = stringValue(req.query.view);
    const search = stringValue(req.query.search);
    const parentId = objectId(req.query.parentId);

    let query: Record<string, unknown> = {
      organizationId: orgReq.organization._id,
      status: view === "trash" ? "trashed" : "active",
    };

    if (search) {
      query = {
        ...query,
        name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      };
    } else if (view === "shared") {
      const grants = await DrivePermission.find({
        organizationId: orgReq.organization._id,
        targetUserId: orgReq.user.id,
      })
        .select("nodeId")
        .lean();
      query._id = { $in: grants.map((grant) => grant.nodeId) };
    } else {
      query.parentId = parentId;
      if (parentId) {
        const parent = await requireDriveNode({
          organizationId: orgReq.organization._id,
          nodeId: String(parentId),
        });
        await assertDriveAccess({
          node: parent,
          userId: orgReq.user.id,
          organizationRole: orgReq.organizationMembership.role,
          minimumRole: "viewer",
        });
      }
    }

    const nodes = await DriveNode.find(query)
      .sort({ type: 1, name: 1, updatedAt: -1 })
      .limit(250);

    res.json({ nodes: await filterAccessible(nodes, orgReq) });
  } catch (err: any) {
    res.status(err.message?.includes("denied") ? 403 : 500).json({ error: err.message || "Failed to list Drive items" });
  }
}

export async function getDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "viewer",
    });
    res.json({ node: await serializeNodeForUser(node, orgReq) });
  } catch (err: any) {
    res.status(err.message?.includes("denied") ? 403 : 404).json({ error: err.message || "Drive item not found" });
  }
}

export async function createDriveFolder(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const name = normalizeNodeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }
    const parentId = objectId(req.body?.parentId);
    await validateParentAccess(orgReq, parentId);

    const folder = await DriveNode.create({
      organizationId: orgReq.organization._id,
      parentId,
      type: "folder",
      name,
      ownerUserId: orgReq.user.id,
      createdByUserId: orgReq.user.id,
      updatedByUserId: orgReq.user.id,
      upload: { status: "none" },
    });

    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: folder._id,
      actorUserId: orgReq.user.id,
      action: "folder_created",
    });

    res.status(201).json({ node: await serializeNodeForUser(folder, orgReq) });
  } catch (err: any) {
    res.status(err.message?.includes("denied") ? 403 : 400).json({ error: err.message || "Failed to create folder" });
  }
}

export async function initiateDriveUpload(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const fileName = normalizeNodeName(req.body?.fileName);
    const contentType = stringValue(req.body?.contentType).toLowerCase() || "application/octet-stream";
    const size = Number(req.body?.size ?? 0);
    const parentId = objectId(req.body?.parentId);
    if (!fileName || !Number.isFinite(size) || size <= 0) {
      res.status(400).json({ error: "File name and size are required" });
      return;
    }
    if (size > MAX_DRIVE_FILE_SIZE) {
      res.status(400).json({ error: "Drive files must be 1GB or smaller" });
      return;
    }

    await validateParentAccess(orgReq, parentId);
    await reserveDriveBytes(orgReq.organization._id, size);

    const partCount = Math.ceil(size / MULTIPART_PART_SIZE);
    const session = await createMultipartUpload({
      scope: "drive",
      organizationId: String(orgReq.organization._id),
      fileName,
      contentType,
      size,
      prefixParts: parentId ? [String(parentId)] : [],
    });

    const node = await DriveNode.create({
      organizationId: orgReq.organization._id,
      parentId,
      type: "file",
      name: fileName,
      storageKey: session.key,
      bucket: session.bucket,
      contentType,
      size,
      ownerUserId: orgReq.user.id,
      createdByUserId: orgReq.user.id,
      updatedByUserId: orgReq.user.id,
      upload: {
        status: "initiated",
        uploadId: session.uploadId,
        partSize: MULTIPART_PART_SIZE,
        partCount,
      },
    });

    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_, index) => ({
        partNumber: index + 1,
        ...(await createPresignedUploadPartUrl({
          key: session.key,
          uploadId: session.uploadId,
          partNumber: index + 1,
        })),
      }))
    );

    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "upload_initiated",
      metadata: { size, contentType },
    });

    res.status(201).json({
      node: await serializeNodeForUser(node, orgReq),
      uploadId: session.uploadId,
      partSize: MULTIPART_PART_SIZE,
      partCount,
      parts,
    });
  } catch (err: any) {
    res.status(err.message?.includes("quota") ? 413 : 400).json({ error: err.message || "Failed to initiate upload" });
  }
}

export async function getDriveUploadPartUrl(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    const partNumber = Number(req.body?.partNumber ?? req.query.partNumber);
    if (!node.storageKey || !node.upload.uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
      res.status(400).json({ error: "Invalid upload part request" });
      return;
    }
    res.json(await createPresignedUploadPartUrl({
      key: node.storageKey,
      uploadId: node.upload.uploadId,
      partNumber,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create upload part URL" });
  }
}

export async function completeDriveUpload(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    if (!node.storageKey || !node.upload.uploadId || node.upload.status !== "initiated") {
      res.status(400).json({ error: "Upload is not active" });
      return;
    }
    const parts = Array.isArray(req.body?.parts) ? req.body.parts : [];
    await completeMultipartUpload({
      key: node.storageKey,
      uploadId: node.upload.uploadId,
      parts: parts.map((part: any) => ({
        partNumber: Number(part.partNumber),
        etag: String(part.etag ?? part.ETag ?? ""),
      })),
    });
    node.upload.status = "completed";
    node.upload.completedAt = new Date();
    node.updatedByUserId = orgReq.user.id;
    await node.save();
    await commitReservedDriveBytes(orgReq.organization._id, node.size);

    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "upload_completed",
      metadata: { size: node.size, contentType: node.contentType },
    });

    res.json({ node: await serializeNodeForUser(node, orgReq) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to complete upload" });
  }
}

export async function abortDriveUpload(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    if (node.storageKey && node.upload.uploadId && node.upload.status === "initiated") {
      await abortMultipartUpload({ key: node.storageKey, uploadId: node.upload.uploadId });
      await releaseReservedDriveBytes(orgReq.organization._id, node.size);
    }
    node.upload.status = "aborted";
    node.status = "deleted";
    node.deletedAt = new Date();
    node.deletedByUserId = orgReq.user.id;
    await node.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to abort upload" });
  }
}

export async function updateDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    const name = normalizeNodeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const oldName = node.name;
    node.name = name;
    node.updatedByUserId = orgReq.user.id;
    await node.save();
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "renamed",
      metadata: { oldName, newName: name },
    });
    res.json({ node: await serializeNodeForUser(node, orgReq) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update Drive item" });
  }
}

const AI_TEXT_MAX_BYTES = 256 * 1024;
const AI_TEXT_SNIPPET_CHARS = 6000;
const AI_PDF_MAX_BYTES = 20 * 1024 * 1024;

function isPdfForAi(contentType: string, name: string): boolean {
  const type = (contentType || "").toLowerCase();
  return type === "application/pdf" || type === "application/x-pdf" || /\.pdf$/i.test(name || "");
}

function isTextLikeForAi(contentType: string, name: string): boolean {
  const type = (contentType || "").toLowerCase();
  if (type.startsWith("text/")) return true;
  if (
    [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/typescript",
      "application/csv",
      "application/x-yaml",
      "application/yaml",
    ].includes(type)
  ) {
    return true;
  }
  return /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|jsx?|tsx?|py|java|c|cpp|h|cs|go|rb|rs|php|sh|sql|html?|css|scss|ini|log|toml)$/i.test(
    name || ""
  );
}

function fileExtension(name: string): string {
  const match = /\.[A-Za-z0-9]{1,8}$/.exec(name);
  return match ? match[0] : "";
}

export async function suggestDriveNodeName(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });

    if (node.type !== "file" || !node.storageKey) {
      res.status(400).json({ error: "Only files can be named with AI" });
      return;
    }

    const contentType = node.contentType ?? "";
    const size = node.size ?? 0;
    let imageUrl: string | null = null;
    let textSnippet: string | null = null;
    let pdf: { fileName: string; fileData: string } | null = null;

    if (contentType.toLowerCase().startsWith("image/")) {
      const { url } = await createPresignedViewUrl(node.storageKey);
      imageUrl = url;
    } else if (isPdfForAi(contentType, node.name) && size > 0 && size <= AI_PDF_MAX_BYTES) {
      const buffer = await getObjectBuffer(node.storageKey);
      pdf = { fileName: node.name, fileData: `data:application/pdf;base64,${buffer.toString("base64")}` };
    } else if (isTextLikeForAi(contentType, node.name) && size > 0 && size <= AI_TEXT_MAX_BYTES) {
      try {
        const buffer = await getObjectBuffer(node.storageKey);
        textSnippet = buffer.toString("utf8").slice(0, AI_TEXT_SNIPPET_CHARS);
      } catch {
        textSnippet = null;
      }
    }

    const base = await suggestFileName({
      currentName: node.name,
      contentType,
      size,
      textSnippet,
      imageUrl,
      pdf,
    });

    if (!base) {
      res.status(502).json({ error: "AI did not return a name. Please try again." });
      return;
    }

    const extension = fileExtension(node.name);
    const name =
      extension && !base.toLowerCase().endsWith(extension.toLowerCase()) ? `${base}${extension}` : base;

    res.json({ name });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to suggest a name" });
  }
}

export async function moveDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    const parentId = objectId(req.body?.parentId);
    await validateParentAccess(orgReq, parentId);
    if (node.type === "folder" && parentId) {
      const invalidMove = await isDescendantOf({
        organizationId: orgReq.organization._id,
        nodeId: parentId,
        possibleAncestorId: node._id,
      });
      if (invalidMove || parentId.equals(node._id)) {
        res.status(400).json({ error: "Cannot move a folder into itself" });
        return;
      }
    }
    const oldParentId = node.parentId ? String(node.parentId) : null;
    node.parentId = parentId;
    node.updatedByUserId = orgReq.user.id;
    await node.save();
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "moved",
      metadata: { oldParentId, newParentId: parentId ? String(parentId) : null },
    });
    res.json({ node: await serializeNodeForUser(node, orgReq) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to move Drive item" });
  }
}

export async function trashDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    const ids = [node._id, ...(await getDriveDescendantIds({ organizationId: orgReq.organization._id, nodeId: node._id }))];
    await DriveNode.updateMany(
      { _id: { $in: ids }, organizationId: orgReq.organization._id },
      { status: "trashed", trashedAt: new Date(), trashedByUserId: orgReq.user.id }
    );
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "trashed",
      metadata: { itemCount: ids.length },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to move item to Trash" });
  }
}

export async function restoreDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "editor",
    });
    const ids = [node._id, ...(await getDriveDescendantIds({ organizationId: orgReq.organization._id, nodeId: node._id }))];
    const parent = node.parentId
      ? await DriveNode.findOne({ _id: node.parentId, organizationId: orgReq.organization._id, status: "active" }).lean()
      : null;
    await DriveNode.updateMany(
      { _id: { $in: ids }, organizationId: orgReq.organization._id, status: "trashed" },
      { status: "active", trashedAt: null, trashedByUserId: null }
    );
    if (node.parentId && !parent) {
      await DriveNode.updateOne({ _id: node._id }, { parentId: null });
    }
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "restored",
      metadata: { itemCount: ids.length },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to restore Drive item" });
  }
}

export async function permanentlyDeleteDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    if (!isOrgDriveAdmin(orgReq.organizationMembership.role)) {
      res.status(403).json({ error: "Only organization owners and admins can permanently delete Drive items" });
      return;
    }
    const node = await requireDriveNode({
      organizationId: orgReq.organization._id,
      nodeId: paramValue(req, "id"),
      includeTrashed: true,
    });
    const ids = [node._id, ...(await getDriveDescendantIds({ organizationId: orgReq.organization._id, nodeId: node._id }))];
    const files = await DriveNode.find({
      _id: { $in: ids },
      organizationId: orgReq.organization._id,
      type: "file",
      storageKey: { $ne: null },
    }).select("storageKey size");
    for (const file of files) {
      if (file.storageKey) await deleteObject(file.storageKey);
    }
    const bytes = files.reduce((sum, file) => sum + file.size, 0);
    await releaseUsedDriveBytes(orgReq.organization._id, bytes);
    await DriveNode.updateMany(
      { _id: { $in: ids }, organizationId: orgReq.organization._id },
      { status: "deleted", deletedAt: new Date(), deletedByUserId: orgReq.user.id }
    );
    await DrivePermission.deleteMany({ organizationId: orgReq.organization._id, nodeId: { $in: ids } });
    await DrivePublicLink.updateMany(
      { organizationId: orgReq.organization._id, nodeId: { $in: ids } },
      { status: "revoked" }
    );
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "deleted",
      metadata: { itemCount: ids.length, bytes },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to permanently delete Drive item" });
  }
}

export async function getDriveFileUrl(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "viewer",
    });
    if (node.type !== "file" || !node.storageKey) {
      res.status(400).json({ error: "Drive item is not a file" });
      return;
    }
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: req.path.includes("download") ? "downloaded" : "public_link_accessed",
    });
    res.json(await createPresignedViewUrl(node.storageKey));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create file URL" });
  }
}

export async function listDriveShares(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    const shares = await DrivePermission.find({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
    }).lean();
    const users = await resolveUsersByIds(shares.map((share) => share.targetUserId));
    res.json({
      shares: shares.map((share) => ({
        _id: String(share._id),
        userId: share.targetUserId,
        role: share.role,
        source: share.source,
        user: users.get(share.targetUserId) ?? null,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
      })),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to list shares" });
  }
}

export async function shareDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    const role = req.body?.role === "editor" ? "editor" : "viewer" as DrivePermissionRole;
    let targetUserId = stringValue(req.body?.userId);
    if (!targetUserId && req.body?.email) {
      const user = await resolveUserByEmail(stringValue(req.body.email));
      targetUserId = user?.id ?? "";
    }
    if (!targetUserId) {
      res.status(400).json({ error: "A target organization user is required" });
      return;
    }
    const member = await OrganizationMember.findOne({
      organizationId: orgReq.organization._id,
      userId: targetUserId,
    }).lean();
    if (!member) {
      res.status(400).json({ error: "User must be an organization member before Drive items can be shared" });
      return;
    }
    await DrivePermission.updateOne(
      { organizationId: orgReq.organization._id, nodeId: node._id, targetUserId },
      { role, source: "direct", grantedByUserId: orgReq.user.id },
      { upsert: true }
    );
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "shared",
      metadata: { targetUserId, role },
    });
    res.status(201).json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to share Drive item" });
  }
}

export async function unshareDriveNode(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    const targetUserId = paramValue(req, "userId");
    await DrivePermission.deleteOne({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      targetUserId,
    });
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "unshared",
      metadata: { targetUserId },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to remove Drive share" });
  }
}

export async function listDrivePublicLinks(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    const links = await DrivePublicLink.find({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      status: "active",
    }).sort({ createdAt: -1 }).lean();
    res.json({ links: links.map(serializePublicLink) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to list public links" });
  }
}

export async function createDrivePublicLink(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    const password = stringValue(req.body?.password);
    const passwordFields = password ? hashPassword(password) : null;
    const link = await DrivePublicLink.create({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      token: crypto.randomBytes(24).toString("base64url"),
      createdByUserId: orgReq.user.id,
      expiresAt: parseExpiry(req.body?.expiresAt),
      allowDownload: req.body?.allowDownload !== false,
      ...(passwordFields ? { passwordHash: passwordFields.hash, passwordSalt: passwordFields.salt } : {}),
    });
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "public_link_created",
      metadata: { linkId: String(link._id), expiresAt: link.expiresAt },
    });
    res.status(201).json({ link: serializePublicLink(link.toObject()) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create public link" });
  }
}

export async function revokeDrivePublicLink(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    if (!canManageDriveSharing({ node, userId: orgReq.user.id, organizationRole: orgReq.organizationMembership.role })) {
      res.status(403).json({ error: "Drive sharing access denied" });
      return;
    }
    await DrivePublicLink.updateOne(
      { _id: paramValue(req, "linkId"), organizationId: orgReq.organization._id, nodeId: node._id },
      { status: "revoked" }
    );
    recordDriveAuditEvent({
      organizationId: orgReq.organization._id,
      nodeId: node._id,
      actorUserId: orgReq.user.id,
      action: "public_link_revoked",
      metadata: { linkId: paramValue(req, "linkId") },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to revoke public link" });
  }
}

export async function getDriveQuota(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const quota = await getOrCreateDriveQuota(orgReq.organization._id);
    res.json({ quota });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch Drive quota" });
  }
}

export async function createDriveExport(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const node = await requireDriveNode({ organizationId: orgReq.organization._id, nodeId: paramValue(req, "id") });
    await assertDriveAccess({
      node,
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
      minimumRole: "viewer",
    });
    if (node.type !== "folder") {
      res.status(400).json({ error: "Only folders can be exported as ZIP files" });
      return;
    }
    const job = await createDriveExportJob({
      organizationId: orgReq.organization._id,
      node,
      requestedByUserId: orgReq.user.id,
    });
    res.status(202).json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to start export" });
  }
}

export async function getDriveExport(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const job = await DriveExportJob.findOne({
      _id: paramValue(req, "jobId"),
      organizationId: orgReq.organization._id,
    }).lean();
    if (!job) {
      res.status(404).json({ error: "Export job not found" });
      return;
    }
    if (job.archiveKey && req.path.includes("download")) {
      res.json(await createPresignedViewUrl(job.archiveKey));
      return;
    }
    res.json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to fetch export job" });
  }
}

export async function getPublicDriveLink(req: Request, res: Response): Promise<void> {
  try {
    const password = stringValue(req.query.password);
    const { link, root, locked } = await validatePublicLink(paramValue(req, "token"), password);
    if (locked) {
      res.json({ locked: true, hasPassword: true });
      return;
    }
    await DrivePublicLink.updateOne({ _id: link._id }, { $inc: { viewCount: 1 }, lastViewedAt: new Date() });
    recordDriveAuditEvent({
      organizationId: link.organizationId,
      nodeId: root._id,
      actorUserId: null,
      action: "public_link_accessed",
      metadata: { linkId: String(link._id) },
    });
    res.json({
      locked: false,
      link: serializePublicLink(link.toObject()),
      node: serializeNode(root.toObject(), "viewer"),
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message || "Share link not found" });
  }
}

export async function listPublicDriveChildren(req: Request, res: Response): Promise<void> {
  try {
    const { link, root, locked } = await validatePublicLink(paramValue(req, "token"), stringValue(req.query.password));
    if (locked) {
      res.status(403).json({ error: "Password required" });
      return;
    }
    const parent = await requirePublicNode({ link, root, nodeId: stringValue(req.query.parentId) || String(root._id) });
    if (parent.type !== "folder") {
      res.status(400).json({ error: "Shared item is not a folder" });
      return;
    }
    const children = await DriveNode.find({
      organizationId: link.organizationId,
      parentId: parent._id,
      status: "active",
    }).sort({ type: 1, name: 1 });
    res.json({ nodes: children.map((node) => serializeNode(node.toObject(), "viewer")) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to list shared folder" });
  }
}

export async function getPublicDriveFileUrl(req: Request, res: Response): Promise<void> {
  try {
    const { link, root, locked } = await validatePublicLink(paramValue(req, "token"), stringValue(req.query.password));
    if (locked) {
      res.status(403).json({ error: "Password required" });
      return;
    }
    if (!link.allowDownload && req.path.includes("download")) {
      res.status(403).json({ error: "Downloads are disabled for this link" });
      return;
    }
    const node = await requirePublicNode({ link, root, nodeId: paramValue(req, "nodeId") });
    if (node.type !== "file" || !node.storageKey) {
      res.status(400).json({ error: "Shared item is not a file" });
      return;
    }
    recordDriveAuditEvent({
      organizationId: link.organizationId,
      nodeId: node._id,
      actorUserId: null,
      action: req.path.includes("download") ? "downloaded" : "public_link_accessed",
      metadata: { linkId: String(link._id) },
    });
    res.json(await createPresignedViewUrl(node.storageKey));
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create shared file URL" });
  }
}

export async function createPublicDriveExport(req: Request, res: Response): Promise<void> {
  try {
    const { link, root, locked } = await validatePublicLink(paramValue(req, "token"), stringValue(req.body?.password ?? req.query.password));
    if (locked) {
      res.status(403).json({ error: "Password required" });
      return;
    }
    if (!link.allowDownload) {
      res.status(403).json({ error: "Downloads are disabled for this link" });
      return;
    }
    const node = await requirePublicNode({ link, root, nodeId: stringValue(req.body?.nodeId) || String(root._id) });
    if (node.type !== "folder") {
      res.status(400).json({ error: "Only folders can be exported" });
      return;
    }
    const job = await createDriveExportJob({
      organizationId: link.organizationId,
      node,
      publicLinkId: link._id,
    });
    res.status(202).json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to start shared folder export" });
  }
}

export async function getPublicDriveExport(req: Request, res: Response): Promise<void> {
  try {
    const { link, locked } = await validatePublicLink(paramValue(req, "token"), stringValue(req.query.password));
    if (locked) {
      res.status(403).json({ error: "Password required" });
      return;
    }
    const job = await DriveExportJob.findOne({
      _id: paramValue(req, "jobId"),
      organizationId: link.organizationId,
      publicLinkId: link._id,
    }).lean();
    if (!job) {
      res.status(404).json({ error: "Export job not found" });
      return;
    }
    if (job.archiveKey && req.path.includes("download")) {
      res.json(await createPresignedViewUrl(job.archiveKey));
      return;
    }
    res.json({ job });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to fetch export job" });
  }
}
