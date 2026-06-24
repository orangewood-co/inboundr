import mongoose, { type ClientSession, type Types } from "mongoose";
import {
  AccessGroup,
  type AccessGroupDefaultKey,
  type IAccessGroup,
} from "../models/access-group.model";
import {
  EMPLOYEE_ACCESS_MODULES,
  type EmployeeAccessModule,
} from "../models/employee-team.model";
import type { OrganizationRole } from "../models/organization-member.model";

export const DEFAULT_ACCESS_GROUP_NAMES: Record<AccessGroupDefaultKey, string> = {
  admin: "Admin",
  members: "Members",
};

export const DEFAULT_MEMBERS_MODULES: EmployeeAccessModule[] = [
  ...EMPLOYEE_ACCESS_MODULES,
];

type OrganizationId = Types.ObjectId | string;

interface SessionOptions {
  session?: ClientSession | null;
}

function toObjectId(value: OrganizationId): Types.ObjectId {
  return typeof value === "string" ? new mongoose.Types.ObjectId(value) : value;
}

function httpError(message: string, statusCode: number): Error {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

export function normalizeAccessModules(value: unknown): EmployeeAccessModule[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter((module): module is EmployeeAccessModule => {
    return typeof module === "string" && EMPLOYEE_ACCESS_MODULES.includes(module as EmployeeAccessModule);
  });
}

export function normalizeAccessGroupIds(value: unknown): Types.ObjectId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const item of value) {
    const raw = String(item ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(raw) || seen.has(raw)) continue;
    seen.add(raw);
    ids.push(new mongoose.Types.ObjectId(raw));
  }
  return ids;
}

export async function ensureDefaultAccessGroups(
  organizationId: OrganizationId,
  options: SessionOptions = {}
): Promise<Record<AccessGroupDefaultKey, IAccessGroup>> {
  const orgId = toObjectId(organizationId);
  const session = options.session ?? undefined;

  const [admin, members] = await Promise.all([
    AccessGroup.findOneAndUpdate(
      { organizationId: orgId, defaultKey: "admin" },
      {
        $setOnInsert: {
          organizationId: orgId,
          name: DEFAULT_ACCESS_GROUP_NAMES.admin,
          description: "Default group for organization administrators.",
          moduleAccess: [],
          allModules: true,
          canManageOrganization: true,
          isDefault: true,
          defaultKey: "admin",
          status: "active",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    ),
    AccessGroup.findOneAndUpdate(
      { organizationId: orgId, defaultKey: "members" },
      {
        $setOnInsert: {
          organizationId: orgId,
          name: DEFAULT_ACCESS_GROUP_NAMES.members,
          description: "Default group for workspace members.",
          moduleAccess: DEFAULT_MEMBERS_MODULES,
          allModules: false,
          canManageOrganization: false,
          isDefault: true,
          defaultKey: "members",
          status: "active",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    ),
  ]);

  return { admin, members };
}

export function defaultAccessGroupKeyForRole(
  role: OrganizationRole
): AccessGroupDefaultKey {
  return role === "owner" || role === "admin" ? "admin" : "members";
}

export async function defaultAccessGroupIdsForRole(
  organizationId: OrganizationId,
  role: OrganizationRole,
  options: SessionOptions = {}
): Promise<Types.ObjectId[]> {
  const defaults = await ensureDefaultAccessGroups(organizationId, options);
  return [defaults[defaultAccessGroupKeyForRole(role)]._id];
}

export async function resolveAccessGroupIdsForWrite({
  organizationId,
  accessGroupIds,
  fallbackRole = "member",
  allowEmpty = false,
}: {
  organizationId: OrganizationId;
  accessGroupIds: unknown;
  fallbackRole?: OrganizationRole;
  allowEmpty?: boolean;
}): Promise<Types.ObjectId[]> {
  const orgId = toObjectId(organizationId);
  const requestedIds = normalizeAccessGroupIds(accessGroupIds);

  if (requestedIds.length === 0) {
    if (allowEmpty) return [];
    return defaultAccessGroupIdsForRole(orgId, fallbackRole);
  }

  const groups = await AccessGroup.find({
    _id: { $in: requestedIds },
    organizationId: orgId,
    status: "active",
  }).select("_id");

  if (groups.length !== requestedIds.length) {
    throw httpError("One or more access groups are invalid", 400);
  }

  const validIds = new Set(groups.map((group) => group._id.toString()));
  return requestedIds.filter((id) => validIds.has(id.toString()));
}

export function serializeAccessGroup(group: any) {
  return {
    _id: group._id,
    name: group.name,
    description: group.description ?? null,
    moduleAccess: group.moduleAccess ?? [],
    allModules: Boolean(group.allModules),
    canManageOrganization: Boolean(group.canManageOrganization),
    isDefault: Boolean(group.isDefault),
    defaultKey: group.defaultKey ?? null,
    status: group.status ?? "active",
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function serializeAccessGroupSummary(group: any) {
  return {
    _id: group._id,
    name: group.name,
    allModules: Boolean(group.allModules),
    canManageOrganization: Boolean(group.canManageOrganization),
    isDefault: Boolean(group.isDefault),
    defaultKey: group.defaultKey ?? null,
  };
}
