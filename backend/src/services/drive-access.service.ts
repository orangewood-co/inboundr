import mongoose, { type Types } from "mongoose";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import { DrivePermission, type DrivePermissionRole } from "../models/drive-permission.model";
import type { OrganizationRole } from "../models/organization-member.model";

export type DriveEffectiveRole = "none" | "viewer" | "editor";

const ROLE_RANK: Record<DriveEffectiveRole, number> = {
  none: 0,
  viewer: 1,
  editor: 2,
};

function maxRole(current: DriveEffectiveRole, candidate: DrivePermissionRole): DriveEffectiveRole {
  return ROLE_RANK[candidate] > ROLE_RANK[current] ? candidate : current;
}

export function isOrgDriveAdmin(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export function canRoleView(role: DriveEffectiveRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.viewer;
}

export function canRoleEdit(role: DriveEffectiveRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}

export async function getDriveAncestorIds(node: Pick<IDriveNode, "parentId" | "organizationId">): Promise<Types.ObjectId[]> {
  const ancestors: Types.ObjectId[] = [];
  const seen = new Set<string>();
  let parentId = node.parentId;

  while (parentId) {
    const parentIdString = String(parentId);
    if (seen.has(parentIdString)) break;
    seen.add(parentIdString);
    ancestors.push(parentId);

    const parent = await DriveNode.findOne({
      _id: parentId,
      organizationId: node.organizationId,
      status: { $ne: "deleted" },
    })
      .select("parentId organizationId")
      .lean();
    parentId = parent?.parentId ?? null;
  }

  return ancestors;
}

export async function getEffectiveDriveRole(input: {
  node: IDriveNode | (Pick<IDriveNode, "_id" | "organizationId" | "parentId" | "ownerUserId" | "createdByUserId"> & { _id: Types.ObjectId });
  userId: string;
  organizationRole: OrganizationRole;
}): Promise<DriveEffectiveRole> {
  if (isOrgDriveAdmin(input.organizationRole)) return "editor";
  if (input.node.ownerUserId === input.userId || input.node.createdByUserId === input.userId) return "editor";

  const nodeIds = [input.node._id, ...(await getDriveAncestorIds(input.node))];
  const grants = await DrivePermission.find({
    organizationId: input.node.organizationId,
    nodeId: { $in: nodeIds },
    targetUserId: input.userId,
  })
    .select("role")
    .lean();

  return grants.reduce<DriveEffectiveRole>((role, grant) => maxRole(role, grant.role), "none");
}

export async function requireDriveNode(input: {
  organizationId: Types.ObjectId;
  nodeId: string;
  includeTrashed?: boolean;
}): Promise<IDriveNode> {
  if (!mongoose.Types.ObjectId.isValid(input.nodeId)) {
    throw new Error("Invalid Drive item id");
  }

  const nodeQuery: Record<string, unknown> = {
    _id: input.nodeId,
    organizationId: input.organizationId,
    status: input.includeTrashed ? { $ne: "deleted" } : "active",
  };
  const node = await DriveNode.findOne(nodeQuery);

  if (!node) {
    throw new Error("Drive item not found");
  }

  return node;
}

export async function assertDriveAccess(input: {
  node: IDriveNode;
  userId: string;
  organizationRole: OrganizationRole;
  minimumRole: Exclude<DriveEffectiveRole, "none">;
}): Promise<DriveEffectiveRole> {
  const role = await getEffectiveDriveRole(input);
  if (ROLE_RANK[role] < ROLE_RANK[input.minimumRole]) {
    throw new Error("Drive access denied");
  }
  return role;
}

export function canManageDriveSharing(input: {
  node: Pick<IDriveNode, "ownerUserId" | "createdByUserId">;
  userId: string;
  organizationRole: OrganizationRole;
}): boolean {
  return (
    isOrgDriveAdmin(input.organizationRole) ||
    input.node.ownerUserId === input.userId ||
    input.node.createdByUserId === input.userId
  );
}

export async function getDriveDescendantIds(input: {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
}): Promise<Types.ObjectId[]> {
  const descendants: Types.ObjectId[] = [];
  const queue = [input.nodeId];

  while (queue.length) {
    const parentId = queue.shift()!;
    const children = await DriveNode.find({
      organizationId: input.organizationId,
      parentId,
      status: { $ne: "deleted" },
    })
      .select("_id")
      .lean();
    for (const child of children) {
      descendants.push(child._id);
      queue.push(child._id);
    }
  }

  return descendants;
}

export async function isDescendantOf(input: {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  possibleAncestorId: Types.ObjectId;
}): Promise<boolean> {
  const ancestors = await getDriveAncestorIds({
    organizationId: input.organizationId,
    parentId: input.nodeId,
  });
  return ancestors.some((id) => id.equals(input.possibleAncestorId));
}
