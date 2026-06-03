import { createElement } from "react";
import type { Types } from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Employee } from "../models/employee.model";
import {
  ProjectActivity,
  type IProject,
  type ProjectActivityType,
} from "../models/project.model";
import { ProjectUpdateEmail } from "../emails/project-update";
import { frontendOrigin } from "../config/origins.config";
import { sendEmail } from "../lib/email";
const EMAIL_ACTIVITY_TYPES = new Set<ProjectActivityType>([
  "project_updated",
  "project_archived",
  "task_created",
  "task_updated",
  "task_moved",
  "subtask_created",
  "time_entry_added",
]);

export async function recordProjectActivity(input: {
  req: OrganizationRequest;
  project: IProject;
  taskId?: Types.ObjectId | null;
  actorEmployeeId?: Types.ObjectId | null;
  type: ProjectActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  notifyFollowers?: boolean;
}) {
  const activity = await ProjectActivity.create({
    organizationId: input.project.organizationId,
    projectId: input.project._id,
    taskId: input.taskId ?? null,
    actorUserId: input.req.user.id,
    actorEmployeeId: input.actorEmployeeId ?? null,
    type: input.type,
    message: input.message,
    metadata: input.metadata ?? {},
  });

  if (input.notifyFollowers && EMAIL_ACTIVITY_TYPES.has(input.type)) {
    void notifyProjectFollowers({
      project: input.project,
      actorEmail: input.req.user.email ?? "",
      actorName: input.req.user.name ?? "",
      organizationName: input.req.organization.name,
      message: input.message,
    });
  }

  return activity;
}

async function notifyProjectFollowers({
  project,
  actorEmail,
  actorName,
  organizationName,
  message,
}: {
  project: IProject;
  actorEmail: string;
  actorName: string;
  organizationName: string;
  message: string;
}) {
  try {
    const followers = await Employee.find({
      _id: { $in: project.followerIds },
      organizationId: project.organizationId,
      status: "active",
    })
      .select("email fullName")
      .lean();

    const recipients = followers
      .map((employee) => ({
        email: employee.email,
        name: employee.fullName,
      }))
      .filter((recipient) => recipient.email && recipient.email.toLowerCase() !== actorEmail.toLowerCase());

    if (recipients.length === 0) return;

    await sendEmail({
      to: recipients.map((recipient) => recipient.email),
      subject: `Project update: ${project.title}`,
      react: createElement(ProjectUpdateEmail, {
        actorName,
        message,
        organizationName,
        projectTitle: project.title,
        projectUrl: `${frontendOrigin}/projects/${project._id.toString()}`,
      }),
    });
  } catch (err) {
    console.error("Failed to notify project followers:", err);
  }
}
