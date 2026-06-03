import { Router } from "express";
import {
  archiveProject,
  archiveProjectStage,
  archiveProjectTask,
  createProject,
  createProjectStage,
  createProjectSubtask,
  createProjectTask,
  createProjectTimeEntry,
  getProject,
  getProjectsReferenceData,
  listProjectActivity,
  listProjects,
  moveProjectTask,
  reorderProjectStages,
  updateProject,
  updateProjectStage,
  updateProjectTask,
} from "../controllers/project.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireEmployeeModule("projects"));

router.get("/", listProjects);
router.get("/reference-data", getProjectsReferenceData);
router.post("/", requireOrganizationRole(["owner", "admin"]), createProject);
router.get("/:id", getProject);
router.put("/:id", updateProject);
router.patch("/:id/archive", archiveProject);
router.get("/:id/activity", listProjectActivity);

router.post("/:id/stages", createProjectStage);
router.patch("/:id/stages/reorder", reorderProjectStages);
router.put("/:id/stages/:stageId", updateProjectStage);
router.patch("/:id/stages/:stageId/archive", archiveProjectStage);

router.post("/:id/tasks", createProjectTask);
router.put("/:id/tasks/:taskId", updateProjectTask);
router.patch("/:id/tasks/:taskId/move", moveProjectTask);
router.patch("/:id/tasks/:taskId/archive", archiveProjectTask);
router.post("/:id/tasks/:taskId/subtasks", createProjectSubtask);
router.post("/:id/tasks/:taskId/time-entries", createProjectTimeEntry);

export default router;
