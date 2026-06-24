import type { Types } from "mongoose";
import { AccessGroup } from "../models/access-group.model";
import type { EmployeeAccessModule } from "../models/employee-team.model";
import { OrganizationMember } from "../models/organization-member.model";
import type { OrganizationRole } from "../models/organization-member.model";

export interface EmployeeAccessState {
  restricted: boolean;
  enabled: boolean;
  employeeId: string | null;
  allowedModules: EmployeeAccessModule[];
  canManageOrganization: boolean;
}

export async function getEmployeeAccessState({
  organizationId,
  organizationMemberId,
  role,
}: {
  organizationId: Types.ObjectId;
  organizationMemberId?: Types.ObjectId | null;
  role: OrganizationRole;
}): Promise<EmployeeAccessState> {
  if (role === "owner") {
    return {
      restricted: false,
      enabled: true,
      employeeId: null,
      allowedModules: [],
      canManageOrganization: true,
    };
  }

  if (!organizationMemberId) {
    return {
      restricted: true,
      enabled: false,
      employeeId: null,
      allowedModules: [],
      canManageOrganization: false,
    };
  }

  const membership = await OrganizationMember.findOne({
    _id: organizationMemberId,
    organizationId,
  })
    .select("accessGroupIds")
    .lean();

  if (!membership) {
    return {
      restricted: true,
      enabled: false,
      employeeId: null,
      allowedModules: [],
      canManageOrganization: false,
    };
  }

  const accessGroupIds = membership.accessGroupIds ?? [];
  if (accessGroupIds.length === 0) {
    return {
      restricted: true,
      enabled: true,
      employeeId: null,
      allowedModules: [],
      canManageOrganization: false,
    };
  }

  const groups = await AccessGroup.find({
    _id: { $in: accessGroupIds },
    organizationId,
    status: "active",
  }).lean();

  const canManageOrganization = groups.some((group) => group.canManageOrganization);
  const allModules = groups.some((group) => group.allModules);
  if (allModules) {
    return {
      restricted: false,
      enabled: true,
      employeeId: null,
      allowedModules: [],
      canManageOrganization,
    };
  }

  const allowedModules = [
    ...new Set(groups.flatMap((group) => group.moduleAccess ?? [])),
  ];
  return {
    restricted: true,
    enabled: true,
    employeeId: null,
    allowedModules,
    canManageOrganization,
  };
}
