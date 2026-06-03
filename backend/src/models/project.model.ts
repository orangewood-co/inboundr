import mongoose, { Schema, type Document, type Types } from "mongoose";

export const PROJECT_VISIBILITY_MODES = ["internal", "private", "teams"] as const;
export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;
export const PROJECT_ACTIVITY_TYPES = [
  "project_created",
  "project_updated",
  "project_archived",
  "stage_created",
  "stage_updated",
  "stage_reordered",
  "stage_archived",
  "task_created",
  "task_updated",
  "task_moved",
  "task_archived",
  "subtask_created",
  "time_entry_added",
] as const;

export type ProjectVisibilityMode = (typeof PROJECT_VISIBILITY_MODES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectActivityType = (typeof PROJECT_ACTIVITY_TYPES)[number];

export interface IProject extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  title: string;
  description: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  status: ProjectStatus;
  visibility: ProjectVisibilityMode;
  visibleTeamIds: Types.ObjectId[];
  memberIds: Types.ObjectId[];
  managerIds: Types.ObjectId[];
  followerIds: Types.ObjectId[];
  createdByUserId: string;
  createdByMemberId: Types.ObjectId | null;
  archivedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectStage extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  order: number;
  color: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectTask extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  stageId: Types.ObjectId;
  parentTaskId: Types.ObjectId | null;
  title: string;
  description: string | null;
  assigneeIds: Types.ObjectId[];
  startDate: Date | null;
  dueDate: Date | null;
  estimatedMinutes: number | null;
  order: number;
  isArchived: boolean;
  createdByUserId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectTimeEntry extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId;
  employeeId: Types.ObjectId;
  minutes: number;
  workDate: Date;
  notes: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectActivity extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId | null;
  actorUserId: string | null;
  actorEmployeeId: Types.ObjectId | null;
  type: ProjectActivityType;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const objectIdArray = {
  type: [Schema.Types.ObjectId],
  default: [],
};

const projectSchema = new Schema<IProject>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "active",
      index: true,
    },
    visibility: {
      type: String,
      enum: PROJECT_VISIBILITY_MODES,
      default: "internal",
      index: true,
    },
    visibleTeamIds: { ...objectIdArray, ref: "EmployeeTeam" },
    memberIds: { ...objectIdArray, ref: "Employee" },
    managerIds: { ...objectIdArray, ref: "Employee" },
    followerIds: { ...objectIdArray, ref: "Employee" },
    createdByUserId: { type: String, required: true, index: true },
    createdByMemberId: {
      type: Schema.Types.ObjectId,
      ref: "OrganizationMember",
      default: null,
    },
    archivedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

const projectStageSchema = new Schema<IProjectStage>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
    color: { type: String, default: null, trim: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const projectTaskSchema = new Schema<IProjectTask>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    stageId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectStage",
      required: true,
      index: true,
    },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectTask",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    assigneeIds: { ...objectIdArray, ref: "Employee" },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    estimatedMinutes: { type: Number, default: null, min: 0 },
    order: { type: Number, required: true, default: 0 },
    isArchived: { type: Boolean, default: false, index: true },
    createdByUserId: { type: String, required: true, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const projectTimeEntrySchema = new Schema<IProjectTimeEntry>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectTask",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    minutes: { type: Number, required: true, min: 1 },
    workDate: { type: Date, required: true },
    notes: { type: String, default: null, trim: true },
    createdByUserId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const projectActivitySchema = new Schema<IProjectActivity>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "ProjectTask",
      default: null,
      index: true,
    },
    actorUserId: { type: String, default: null, index: true },
    actorEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    type: {
      type: String,
      enum: PROJECT_ACTIVITY_TYPES,
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
projectSchema.index({ organizationId: 1, visibility: 1, status: 1 });
projectSchema.index({ organizationId: 1, title: "text", description: "text" });

projectStageSchema.index({ organizationId: 1, projectId: 1, order: 1 });
projectStageSchema.index(
  { projectId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isArchived: false } }
);

projectTaskSchema.index({ organizationId: 1, projectId: 1, parentTaskId: 1, order: 1 });
projectTaskSchema.index({ organizationId: 1, projectId: 1, stageId: 1, order: 1 });
projectTaskSchema.index({ organizationId: 1, assigneeIds: 1, isArchived: 1 });
projectTaskSchema.index({ title: "text", description: "text" });

projectTimeEntrySchema.index({ organizationId: 1, projectId: 1, taskId: 1, workDate: -1 });
projectTimeEntrySchema.index({ organizationId: 1, employeeId: 1, workDate: -1 });

projectActivitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });
projectActivitySchema.index({ organizationId: 1, taskId: 1, createdAt: -1 });

export const Project = mongoose.model<IProject>("Project", projectSchema);
export const ProjectStage = mongoose.model<IProjectStage>("ProjectStage", projectStageSchema);
export const ProjectTask = mongoose.model<IProjectTask>("ProjectTask", projectTaskSchema);
export const ProjectTimeEntry = mongoose.model<IProjectTimeEntry>(
  "ProjectTimeEntry",
  projectTimeEntrySchema
);
export const ProjectActivity = mongoose.model<IProjectActivity>(
  "ProjectActivity",
  projectActivitySchema
);
