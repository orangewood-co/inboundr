import { Router } from "express";
import {
  archiveEmployee,
  archiveEmployeeTeam,
  createEmployee,
  createEmployeeTeam,
  downloadEmployeeDocumentPdf,
  generateEmployeeDocument,
  getEmployee,
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
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("employees"));
router.use(requireEmployeeModule("employees"));

router.get("/modules", listEmployeeModules);
router.get("/teams", listEmployeeTeams);
router.post("/teams", requireOrganizationAdmin(), createEmployeeTeam);
router.put("/teams/:id", requireOrganizationAdmin(), updateEmployeeTeam);
router.patch("/teams/:id/archive", requireOrganizationAdmin(), archiveEmployeeTeam);
router.get("/", listEmployees);
router.post("/", requireOrganizationAdmin(), createEmployee);
router.get("/:id", getEmployee);
router.put("/:id", requireOrganizationAdmin(), updateEmployee);
router.patch("/:id/archive", requireOrganizationAdmin(), archiveEmployee);
router.patch("/:id/restore", requireOrganizationAdmin(), restoreEmployee);
router.post("/:id/invite", requireOrganizationAdmin(), inviteEmployee);
router.post("/:id/link-member", requireOrganizationAdmin(), linkEmployeeMember);
router.get("/:id/documents", listEmployeeDocuments);
router.post("/:id/documents", requireOrganizationAdmin(), generateEmployeeDocument);
router.get("/:id/documents/:documentId/pdf", downloadEmployeeDocumentPdf);

export default router;
