import type { Types } from "mongoose";
import { Employee } from "../models/employee.model";
import { EmployeeTeam, type EmployeeAccessModule } from "../models/employee-team.model";
import type { OrganizationRole } from "../models/organization-member.model";

export interface EmployeeAccessState {
  restricted: boolean;
  enabled: boolean;
  employeeId: string | null;
  allowedModules: EmployeeAccessModule[];
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
  if (role === "owner" || !organizationMemberId) {
    return {
      restricted: false,
      enabled: true,
      employeeId: null,
      allowedModules: [],
    };
  }

  const employee = await Employee.findOne({
    organizationId,
    organizationMemberId,
    status: { $ne: "archived" },
  }).lean();

  if (!employee) {
    return {
      restricted: false,
      enabled: true,
      employeeId: null,
      allowedModules: [],
    };
  }

  if (employee.status !== "active" || !employee.platformAccess?.enabled) {
    return {
      restricted: true,
      enabled: false,
      employeeId: String(employee._id),
      allowedModules: [],
    };
  }

  const modules = new Set<EmployeeAccessModule>();
  if (employee.teamId) {
    const team = await EmployeeTeam.findOne({
      _id: employee.teamId,
      organizationId,
      status: "active",
    }).lean();
    for (const module of team?.defaultModules ?? []) {
      modules.add(module);
    }
  }

  for (const module of employee.platformAccess.allowedModules ?? []) {
    modules.add(module);
  }
  for (const module of employee.platformAccess.restrictedModules ?? []) {
    modules.delete(module);
  }

  const allowedModules = [...modules];
  return {
    restricted: allowedModules.length > 0,
    enabled: true,
    employeeId: String(employee._id),
    allowedModules,
  };
}
