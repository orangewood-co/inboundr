import { Router } from "express";
import {
  archiveEmployee,
  archiveEmployeeTeam,
  createEmployee,
  createEmployeeTeam,
  generateEmployeeDocument,
  getEmployee,
  getEmployeeDocumentHtml,
  inviteEmployee,
  linkEmployeeMember,
  listEmployeeDocuments,
  listEmployeeModules,
  listEmployees,
  listEmployeeTeams,
  restoreEmployee,
  updateEmployee,
  updateEmployeeTeam,
} from "../controllers/employee.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireEmployeeModule("employees"));

router.get("/modules", listEmployeeModules);
router.get("/teams", listEmployeeTeams);
router.post("/teams", requireOrganizationRole(["owner", "admin"]), createEmployeeTeam);
router.put("/teams/:id", requireOrganizationRole(["owner", "admin"]), updateEmployeeTeam);
router.patch("/teams/:id/archive", requireOrganizationRole(["owner", "admin"]), archiveEmployeeTeam);
router.get("/", listEmployees);
router.post("/", requireOrganizationRole(["owner", "admin"]), createEmployee);
router.get("/:id", getEmployee);
router.put("/:id", requireOrganizationRole(["owner", "admin"]), updateEmployee);
router.patch("/:id/archive", requireOrganizationRole(["owner", "admin"]), archiveEmployee);
router.patch("/:id/restore", requireOrganizationRole(["owner", "admin"]), restoreEmployee);
router.post("/:id/invite", requireOrganizationRole(["owner", "admin"]), inviteEmployee);
router.post("/:id/link-member", requireOrganizationRole(["owner", "admin"]), linkEmployeeMember);
router.get("/:id/documents", listEmployeeDocuments);
router.post("/:id/documents", requireOrganizationRole(["owner", "admin"]), generateEmployeeDocument);
router.get("/:id/documents/:documentId/html", getEmployeeDocumentHtml);

export default router;
