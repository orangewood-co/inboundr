import mongoose, { type Types } from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Employee } from "../models/employee.model";
import { EmployeeTeam } from "../models/employee-team.model";
import { Project, type IProject } from "../models/project.model";

export interface ProjectAccessContext {
  employee: {
    _id: Types.ObjectId;
    teamId?: Types.ObjectId | null;
    fullName: string;
    email: string;
  } | null;
  isOrgManager: boolean;
  canManage: boolean;
  canView: boolean;
}

export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

export function toObjectId(value: string): Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function objectIdStrings(values?: Types.ObjectId[] | null): string[] {
  return (values ?? []).map((value) => value.toString());
}

export async function getCurrentProjectEmployee(req: OrganizationRequest) {
  if (!req.organizationMembership?._id) return null;

  return Employee.findOne({
    organizationId: req.organization._id,
    organizationMemberId: req.organizationMembership._id,
    status: "active",
  })
    .select("_id teamId fullName email")
    .lean();
}

export function readableProjectFilter(req: OrganizationRequest, employee: Awaited<ReturnType<typeof getCurrentProjectEmployee>>) {
  const base: Record<string, any> = {
    organizationId: req.organization._id,
    status: { $ne: "archived" },
  };

  if (req.organizationMembership.role === "owner" || req.organizationMembership.role === "admin") {
    return base;
  }

  const employeeId = employee?._id;
  const teamId = employee?.teamId;
  const visibilityClauses: Record<string, any>[] = [
    { visibility: "internal" },
    { createdByUserId: req.user.id },
  ];

  if (employeeId) {
    visibilityClauses.push(
      { memberIds: employeeId },
      { managerIds: employeeId },
      { followerIds: employeeId }
    );
  }

  if (teamId) {
    visibilityClauses.push({
      visibility: "teams",
      visibleTeamIds: teamId,
    });
  }

  return {
    ...base,
    $or: visibilityClauses,
  };
}

export async function getProjectAccess(
  req: OrganizationRequest,
  project: Pick<
    IProject,
    | "visibility"
    | "visibleTeamIds"
    | "memberIds"
    | "managerIds"
    | "followerIds"
    | "createdByUserId"
  >
): Promise<ProjectAccessContext> {
  const employee = await getCurrentProjectEmployee(req);
  const isOrgManager = req.organizationMembership.role === "owner" || req.organizationMembership.role === "admin";
  const employeeId = employee?._id.toString() ?? "";
  const teamId = employee?.teamId?.toString() ?? "";
  const managerIds = objectIdStrings(project.managerIds);
  const memberIds = objectIdStrings(project.memberIds);
  const followerIds = objectIdStrings(project.followerIds);
  const visibleTeamIds = objectIdStrings(project.visibleTeamIds);
  const isCreator = project.createdByUserId === req.user.id;
  const isProjectManager = Boolean(employeeId && managerIds.includes(employeeId));

  const canManage = isOrgManager || isCreator || isProjectManager;
  const canView =
    canManage ||
    project.visibility === "internal" ||
    Boolean(employeeId && (memberIds.includes(employeeId) || followerIds.includes(employeeId))) ||
    Boolean(teamId && project.visibility === "teams" && visibleTeamIds.includes(teamId));

  return {
    employee: employee
      ? {
          _id: employee._id,
          teamId: employee.teamId,
          fullName: employee.fullName,
          email: employee.email,
        }
      : null,
    isOrgManager,
    canManage,
    canView,
  };
}

export async function findReadableProject(req: OrganizationRequest, projectId: string) {
  if (!isValidObjectId(projectId)) {
    throw Object.assign(new Error("Invalid project id"), { statusCode: 400 });
  }

  const employee = await getCurrentProjectEmployee(req);
  const project = await Project.findOne({
    _id: projectId,
    ...readableProjectFilter(req, employee),
  });

  if (!project) {
    throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  }

  return project;
}

export async function requireProjectManager(req: OrganizationRequest, project: IProject) {
  const access = await getProjectAccess(req, project);
  if (!access.canManage) {
    throw Object.assign(new Error("Project manager access required"), { statusCode: 403 });
  }
  return access;
}

export async function ensureEmployeesBelongToOrganization(
  organizationId: Types.ObjectId,
  employeeIds: unknown
): Promise<Types.ObjectId[]> {
  if (!Array.isArray(employeeIds)) return [];
  const ids = [...new Set(employeeIds.map((value) => String(value ?? "")).filter(Boolean))];
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw Object.assign(new Error("Invalid employee id"), { statusCode: 400 });
  }
  if (ids.length === 0) return [];

  const employees = await Employee.find({
    _id: { $in: ids },
    organizationId,
    status: "active",
  })
    .select("_id")
    .lean();

  if (employees.length !== ids.length) {
    throw Object.assign(new Error("One or more employees were not found"), { statusCode: 400 });
  }

  return employees.map((employee) => employee._id);
}

export async function ensureTeamsBelongToOrganization(
  organizationId: Types.ObjectId,
  teamIds: unknown
): Promise<Types.ObjectId[]> {
  if (!Array.isArray(teamIds)) return [];
  const ids = [...new Set(teamIds.map((value) => String(value ?? "")).filter(Boolean))];
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw Object.assign(new Error("Invalid team id"), { statusCode: 400 });
  }
  if (ids.length === 0) return [];

  const teams = await EmployeeTeam.find({
    _id: { $in: ids },
    organizationId,
    status: "active",
  })
    .select("_id")
    .lean();

  if (teams.length !== ids.length) {
    throw Object.assign(new Error("One or more teams were not found"), { statusCode: 400 });
  }

  return teams.map((team) => team._id);
}
