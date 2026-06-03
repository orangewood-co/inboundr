import type { Request, Response } from "express";
import mongoose, { type Types } from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Employee } from "../models/employee.model";
import { EmployeeTeam } from "../models/employee-team.model";
import {
  Project,
  ProjectActivity,
  ProjectStage,
  ProjectTask,
  ProjectTimeEntry,
  PROJECT_STATUSES,
  PROJECT_VISIBILITY_MODES,
  type IProject,
  type ProjectStatus,
  type ProjectVisibilityMode,
} from "../models/project.model";
import {
  ensureEmployeesBelongToOrganization,
  ensureTeamsBelongToOrganization,
  findReadableProject,
  getCurrentProjectEmployee,
  readableProjectFilter,
  requireProjectManager,
} from "../services/project-access.service";
import { recordProjectActivity } from "../services/project-activity.service";

const DEFAULT_STAGES = [
  { name: "To Do", color: "#64748b" },
  { name: "In Progress", color: "#2563eb" },
  { name: "In Review", color: "#d97706" },
  { name: "Done", color: "#16a34a" },
] as const;
const SEARCH_FIELDS = ["title", "description"] as const;

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableString(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized || null;
}

function parseDate(value: unknown): Date | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function normalizeMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function normalizeVisibility(value: unknown): ProjectVisibilityMode {
  return PROJECT_VISIBILITY_MODES.includes(value as ProjectVisibilityMode)
    ? (value as ProjectVisibilityMode)
    : "internal";
}

function normalizeStatus(value: unknown): ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus) ? (value as ProjectStatus) : "active";
}

function objectIdStrings(values: Types.ObjectId[] | undefined): string[] {
  return (values ?? []).map((value) => value.toString());
}

function mergeObjectIds(...groups: Types.ObjectId[][]): Types.ObjectId[] {
  const merged = new Map<string, Types.ObjectId>();
  for (const group of groups) {
    for (const id of group) merged.set(id.toString(), id);
  }
  return [...merged.values()];
}

function statusCode(err: unknown): number {
  return Number((err as any)?.statusCode ?? 500);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

async function normalizeProjectInput(
  body: Record<string, unknown>,
  organizationId: Types.ObjectId,
  partial = false
) {
  const input: Partial<IProject> = {};

  if (!partial || "title" in body) input.title = stringValue(body.title);
  if (!partial || "description" in body) input.description = nullableString(body.description);
  if (!partial || "startDate" in body) input.startDate = parseDate(body.startDate);
  if (!partial || "dueDate" in body) input.dueDate = parseDate(body.dueDate);
  if (!partial || "visibility" in body) input.visibility = normalizeVisibility(body.visibility);
  if ("status" in body) input.status = normalizeStatus(body.status);
  if (!partial || "metadata" in body) {
    input.metadata = typeof body.metadata === "object" && body.metadata !== null && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  }

  if (!partial || "visibleTeamIds" in body) {
    input.visibleTeamIds = await ensureTeamsBelongToOrganization(organizationId, body.visibleTeamIds);
  }
  if (!partial || "memberIds" in body) {
    input.memberIds = await ensureEmployeesBelongToOrganization(organizationId, body.memberIds);
  }
  if (!partial || "managerIds" in body) {
    input.managerIds = await ensureEmployeesBelongToOrganization(organizationId, body.managerIds);
  }
  if (!partial || "followerIds" in body) {
    input.followerIds = await ensureEmployeesBelongToOrganization(organizationId, body.followerIds);
  }

  if (!partial || ("visibility" in body && input.visibility !== "teams")) {
    input.visibleTeamIds = [];
  }
  return input;
}

function validateProjectInput(input: Partial<IProject>): string | null {
  if ("title" in input && !input.title) return "Project title is required";
  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    return "Project start date must be before the due date";
  }
  if (input.visibility === "teams" && (!input.visibleTeamIds || input.visibleTeamIds.length === 0)) {
    return "Select at least one team for team visibility";
  }
  return null;
}

async function normalizeTaskInput(
  body: Record<string, unknown>,
  organizationId: Types.ObjectId,
  projectId: Types.ObjectId,
  partial = false
) {
  const input: Partial<{
    title: string;
    description: string | null;
    stageId: Types.ObjectId;
    assigneeIds: Types.ObjectId[];
    startDate: Date | null;
    dueDate: Date | null;
    estimatedMinutes: number | null;
  }> = {};

  if (!partial || "title" in body) input.title = stringValue(body.title);
  if (!partial || "description" in body) input.description = nullableString(body.description);
  if (!partial || "startDate" in body) input.startDate = parseDate(body.startDate);
  if (!partial || "dueDate" in body) input.dueDate = parseDate(body.dueDate);
  if (!partial || "estimatedMinutes" in body) input.estimatedMinutes = normalizeMinutes(body.estimatedMinutes);
  if (!partial || "assigneeIds" in body) {
    input.assigneeIds = await ensureEmployeesBelongToOrganization(organizationId, body.assigneeIds);
  }
  if (!partial || "stageId" in body) {
    const stageId = stringValue(body.stageId);
    if (!mongoose.Types.ObjectId.isValid(stageId)) {
      throw Object.assign(new Error("Invalid stage id"), { statusCode: 400 });
    }
    const stage = await ProjectStage.findOne({
      _id: stageId,
      organizationId,
      projectId,
      isArchived: { $ne: true },
    }).select("_id");
    if (!stage) throw Object.assign(new Error("Stage not found"), { statusCode: 404 });
    input.stageId = stage._id;
  }

  return input;
}

function validateTaskInput(input: Partial<{ title: string; startDate: Date | null; dueDate: Date | null }>) {
  if ("title" in input && !input.title) return "Task title is required";
  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    return "Task start date must be before the due date";
  }
  return null;
}

async function serializeProjectDetail(project: IProject) {
  const [stages, tasks, timeEntries, activities] = await Promise.all([
    ProjectStage.find({
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    })
      .sort({ order: 1, createdAt: 1 })
      .lean(),
    ProjectTask.find({
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    })
      .sort({ parentTaskId: 1, order: 1, createdAt: 1 })
      .lean(),
    ProjectTimeEntry.find({
      organizationId: project.organizationId,
      projectId: project._id,
    })
      .sort({ workDate: -1, createdAt: -1 })
      .lean(),
    ProjectActivity.find({
      organizationId: project.organizationId,
      projectId: project._id,
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean(),
  ]);

  return {
    project,
    stages,
    tasks,
    timeEntries,
    activities,
  };
}

async function createDefaultStages(project: IProject) {
  await ProjectStage.insertMany(
    DEFAULT_STAGES.map((stage, index) => ({
      organizationId: project.organizationId,
      projectId: project._id,
      name: stage.name,
      color: stage.color,
      order: index,
    }))
  );
}

export const getProjectsReferenceData = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const [employees, teams] = await Promise.all([
      Employee.find({
        organizationId: orgReq.organization._id,
        status: "active",
      })
        .select("_id fullName email title profileImageUrl teamId")
        .sort({ fullName: 1 })
        .lean(),
      EmployeeTeam.find({
        organizationId: orgReq.organization._id,
        status: "active",
      })
        .select("_id name description defaultModules")
        .sort({ name: 1 })
        .lean(),
    ]);

    res.json({ employees, teams });
  } catch (err) {
    console.error("Error fetching project reference data:", err);
    res.status(500).json({ error: "Failed to fetch project reference data" });
  }
};

export const listProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 24, 50);
    const skip = (page - 1) * limit;
    const search = stringValue(req.query.search);
    const status = stringValue(req.query.status);
    const employee = await getCurrentProjectEmployee(orgReq);
    const readableFilter = readableProjectFilter(orgReq, employee);
    const filter: Record<string, any> = {
      ...readableFilter,
      ...(status && PROJECT_STATUSES.includes(status as ProjectStatus)
        ? { status }
        : {}),
      ...(search
        ? {
            $or: [
              ...(readableFilter.$or ?? [{}]),
              ...SEARCH_FIELDS.map((field) => ({ [field]: { $regex: search, $options: "i" } })),
            ],
          }
        : {}),
    };

    if (search && readableFilter.$or) {
      filter.$and = [
        { $or: readableFilter.$or },
        { $or: SEARCH_FIELDS.map((field) => ({ [field]: { $regex: search, $options: "i" } })) },
      ];
      delete filter.$or;
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter),
    ]);

    res.json({
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const input = await normalizeProjectInput(req.body ?? {}, orgReq.organization._id);
    const validationError = validateProjectInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const project = await Project.create({
      ...input,
      memberIds: mergeObjectIds(input.memberIds ?? [], input.managerIds ?? [], input.followerIds ?? []),
      organizationId: orgReq.organization._id,
      createdByUserId: orgReq.user.id,
      createdByMemberId: orgReq.organizationMembership?._id ?? null,
    });
    await createDefaultStages(project);
    await recordProjectActivity({
      req: orgReq,
      project,
      type: "project_created",
      message: `Project "${project.title}" was created.`,
      notifyFollowers: false,
    });

    res.status(201).json(await serializeProjectDetail(project));
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to create project") });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await findReadableProject(req as OrganizationRequest, stringValue(req.params.id));
    res.json(await serializeProjectDetail(project));
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to fetch project") });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    const input = await normalizeProjectInput(req.body ?? {}, orgReq.organization._id, true);
    const validationError = validateProjectInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    project.set({
      ...input,
      ...(input.memberIds || input.managerIds || input.followerIds
        ? {
            memberIds: mergeObjectIds(
              input.memberIds ?? project.memberIds,
              input.managerIds ?? project.managerIds,
              input.followerIds ?? project.followerIds
            ),
          }
        : {}),
    });
    await project.save();
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "project_updated",
      message: `Project "${project.title}" was updated.`,
      notifyFollowers: true,
    });

    res.json(await serializeProjectDetail(project));
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to update project") });
  }
};

export const archiveProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    project.status = "archived";
    project.archivedAt = new Date();
    await project.save();
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "project_archived",
      message: `Project "${project.title}" was archived.`,
      notifyFollowers: true,
    });
    res.json({ message: "Project archived", project });
  } catch (err) {
    console.error("Error archiving project:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to archive project") });
  }
};

export const createProjectStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    const name = stringValue(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Stage name is required" });
      return;
    }
    const count = await ProjectStage.countDocuments({
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    });
    const stage = await ProjectStage.create({
      organizationId: project.organizationId,
      projectId: project._id,
      name,
      color: nullableString(req.body?.color),
      order: count,
    });
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "stage_created",
      message: `Stage "${stage.name}" was created.`,
    });
    res.status(201).json({ stage });
  } catch (err) {
    console.error("Error creating project stage:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to create stage") });
  }
};

export const updateProjectStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    const stage = await ProjectStage.findOne({
      _id: stringValue(req.params.stageId),
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    });
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    if ("name" in req.body) stage.name = stringValue(req.body.name);
    if ("color" in req.body) stage.color = nullableString(req.body.color);
    if (!stage.name) {
      res.status(400).json({ error: "Stage name is required" });
      return;
    }
    await stage.save();
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "stage_updated",
      message: `Stage "${stage.name}" was updated.`,
    });
    res.json({ stage });
  } catch (err) {
    console.error("Error updating project stage:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to update stage") });
  }
};

export const reorderProjectStages = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    const stageIds: string[] = Array.isArray(req.body?.stageIds)
      ? req.body.stageIds.map((id: unknown) => String(id))
      : [];
    if (stageIds.length === 0 || stageIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      res.status(400).json({ error: "Stage order is required" });
      return;
    }
    const stages = await ProjectStage.find({
      _id: { $in: stageIds },
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    });
    if (stages.length !== stageIds.length) {
      res.status(400).json({ error: "One or more stages were not found" });
      return;
    }
    await Promise.all(
      stageIds.map((stageId: string, index: number) =>
        ProjectStage.updateOne({ _id: stageId }, { $set: { order: index } })
      )
    );
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "stage_reordered",
      message: "Project stages were reordered.",
    });
    res.json({ message: "Stages reordered" });
  } catch (err) {
    console.error("Error reordering project stages:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to reorder stages") });
  }
};

export const archiveProjectStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project);
    const stage = await ProjectStage.findOne({
      _id: stringValue(req.params.stageId),
      organizationId: project.organizationId,
      projectId: project._id,
      isArchived: { $ne: true },
    });
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    const taskCount = await ProjectTask.countDocuments({
      organizationId: project.organizationId,
      projectId: project._id,
      stageId: stage._id,
      isArchived: { $ne: true },
    });
    if (taskCount > 0) {
      res.status(400).json({ error: "Move tasks out of this stage before archiving it" });
      return;
    }
    stage.isArchived = true;
    await stage.save();
    await recordProjectActivity({
      req: orgReq,
      project,
      actorEmployeeId: access.employee?._id ?? null,
      type: "stage_archived",
      message: `Stage "${stage.name}" was archived.`,
    });
    res.json({ message: "Stage archived" });
  } catch (err) {
    console.error("Error archiving project stage:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to archive stage") });
  }
};

export const createProjectTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const access = await requireProjectManager(orgReq, project).catch(async () => {
      const employee = await getCurrentProjectEmployee(orgReq);
      return { employee };
    });
    const input = await normalizeTaskInput(req.body ?? {}, project.organizationId, project._id);
    const validationError = validateTaskInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const order = await ProjectTask.countDocuments({
      organizationId: project.organizationId,
      projectId: project._id,
      stageId: input.stageId,
      parentTaskId: null,
      isArchived: { $ne: true },
    });
    const task = await ProjectTask.create({
      ...input,
      organizationId: project.organizationId,
      projectId: project._id,
      parentTaskId: null,
      order,
      createdByUserId: orgReq.user.id,
    });
    if (task.assigneeIds.length > 0) {
      project.memberIds = mergeObjectIds(project.memberIds, task.assigneeIds);
      await project.save();
    }
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: task._id,
      actorEmployeeId: access.employee?._id ?? null,
      type: "task_created",
      message: `Task "${task.title}" was created.`,
      notifyFollowers: true,
    });
    res.status(201).json({ task });
  } catch (err) {
    console.error("Error creating project task:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to create task") });
  }
};

export const updateProjectTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const employee = await getCurrentProjectEmployee(orgReq);
    const input = await normalizeTaskInput(req.body ?? {}, project.organizationId, project._id, true);
    const validationError = validateTaskInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const task = await ProjectTask.findOneAndUpdate(
      {
        _id: stringValue(req.params.taskId),
        organizationId: project.organizationId,
        projectId: project._id,
        isArchived: { $ne: true },
      },
      input,
      { new: true, runValidators: true }
    );
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (input.assigneeIds && input.assigneeIds.length > 0) {
      project.memberIds = mergeObjectIds(project.memberIds, input.assigneeIds);
      await project.save();
    }
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: task._id,
      actorEmployeeId: employee?._id ?? null,
      type: "task_updated",
      message: `Task "${task.title}" was updated.`,
      notifyFollowers: true,
    });
    res.json({ task });
  } catch (err) {
    console.error("Error updating project task:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to update task") });
  }
};

export const moveProjectTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const employee = await getCurrentProjectEmployee(orgReq);
    const stageId = stringValue(req.body?.stageId);
    const order = Math.max(0, Number(req.body?.order ?? 0));
    if (!mongoose.Types.ObjectId.isValid(stageId)) {
      res.status(400).json({ error: "Invalid stage id" });
      return;
    }
    const [stage, task] = await Promise.all([
      ProjectStage.findOne({
        _id: stageId,
        organizationId: project.organizationId,
        projectId: project._id,
        isArchived: { $ne: true },
      }),
      ProjectTask.findOne({
        _id: stringValue(req.params.taskId),
        organizationId: project.organizationId,
        projectId: project._id,
        isArchived: { $ne: true },
      }),
    ]);
    if (!stage || !task) {
      res.status(404).json({ error: !stage ? "Stage not found" : "Task not found" });
      return;
    }
    task.stageId = stage._id;
    task.order = order;
    if ("startDate" in req.body) task.startDate = parseDate(req.body.startDate);
    if ("dueDate" in req.body) task.dueDate = parseDate(req.body.dueDate);
    await task.save();
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: task._id,
      actorEmployeeId: employee?._id ?? null,
      type: "task_moved",
      message: `Task "${task.title}" moved to ${stage.name}.`,
      notifyFollowers: true,
    });
    res.json({ task });
  } catch (err) {
    console.error("Error moving project task:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to move task") });
  }
};

export const archiveProjectTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const employee = await getCurrentProjectEmployee(orgReq);
    const task = await ProjectTask.findOneAndUpdate(
      {
        _id: stringValue(req.params.taskId),
        organizationId: project.organizationId,
        projectId: project._id,
        isArchived: { $ne: true },
      },
      { isArchived: true, archivedAt: new Date() },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: task._id,
      actorEmployeeId: employee?._id ?? null,
      type: "task_archived",
      message: `Task "${task.title}" was archived.`,
      notifyFollowers: true,
    });
    res.json({ message: "Task archived", task });
  } catch (err) {
    console.error("Error archiving project task:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to archive task") });
  }
};

export const createProjectSubtask = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const employee = await getCurrentProjectEmployee(orgReq);
    const parentTask = await ProjectTask.findOne({
      _id: stringValue(req.params.taskId),
      organizationId: project.organizationId,
      projectId: project._id,
      parentTaskId: null,
      isArchived: { $ne: true },
    });
    if (!parentTask) {
      res.status(404).json({ error: "Parent task not found" });
      return;
    }
    const input = await normalizeTaskInput(
      { ...req.body, stageId: req.body?.stageId ?? parentTask.stageId.toString() },
      project.organizationId,
      project._id
    );
    const validationError = validateTaskInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const order = await ProjectTask.countDocuments({
      organizationId: project.organizationId,
      projectId: project._id,
      parentTaskId: parentTask._id,
      isArchived: { $ne: true },
    });
    const subtask = await ProjectTask.create({
      ...input,
      organizationId: project.organizationId,
      projectId: project._id,
      parentTaskId: parentTask._id,
      order,
      createdByUserId: orgReq.user.id,
    });
    if (subtask.assigneeIds.length > 0) {
      project.memberIds = mergeObjectIds(project.memberIds, subtask.assigneeIds);
      await project.save();
    }
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: parentTask._id,
      actorEmployeeId: employee?._id ?? null,
      type: "subtask_created",
      message: `Subtask "${subtask.title}" was added to "${parentTask.title}".`,
      notifyFollowers: true,
    });
    res.status(201).json({ task: subtask });
  } catch (err) {
    console.error("Error creating project subtask:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to create subtask") });
  }
};

export const createProjectTimeEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const project = await findReadableProject(orgReq, stringValue(req.params.id));
    const employee = await getCurrentProjectEmployee(orgReq);
    const employeeId = stringValue(req.body?.employeeId) || employee?._id.toString() || "";
    const minutes = Number(req.body?.minutes ?? 0);
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({ error: "Employee is required for time entry" });
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      res.status(400).json({ error: "Time entry minutes must be greater than zero" });
      return;
    }
    const [task, employeeRecord] = await Promise.all([
      ProjectTask.findOne({
        _id: stringValue(req.params.taskId),
        organizationId: project.organizationId,
        projectId: project._id,
        isArchived: { $ne: true },
      }),
      Employee.findOne({
        _id: employeeId,
        organizationId: project.organizationId,
        status: "active",
      }).select("_id"),
    ]);
    if (!task || !employeeRecord) {
      res.status(404).json({ error: !task ? "Task not found" : "Employee not found" });
      return;
    }
    const entry = await ProjectTimeEntry.create({
      organizationId: project.organizationId,
      projectId: project._id,
      taskId: task._id,
      employeeId: employeeRecord._id,
      minutes: Math.round(minutes),
      workDate: parseDate(req.body?.workDate) ?? new Date(),
      notes: nullableString(req.body?.notes),
      createdByUserId: orgReq.user.id,
    });
    await recordProjectActivity({
      req: orgReq,
      project,
      taskId: task._id,
      actorEmployeeId: employee?._id ?? null,
      type: "time_entry_added",
      message: `${entry.minutes} minutes were logged on "${task.title}".`,
      notifyFollowers: true,
    });
    res.status(201).json({ timeEntry: entry });
  } catch (err) {
    console.error("Error creating project time entry:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to add time entry") });
  }
};

export const listProjectActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await findReadableProject(req as OrganizationRequest, stringValue(req.params.id));
    const activities = await ProjectActivity.find({
      organizationId: project.organizationId,
      projectId: project._id,
    })
      .sort({ createdAt: -1 })
      .limit(120)
      .lean();
    res.json({ activities });
  } catch (err) {
    console.error("Error listing project activity:", err);
    res.status(statusCode(err)).json({ error: errorMessage(err, "Failed to fetch activity") });
  }
};
