import { Router } from "express";
import {
  archiveForm,
  createForm,
  duplicateForm,
  exportSubmissionsCsv,
  getForm,
  listForms,
  listSubmissions,
  updateForm,
  updateSubmissionStatus,
} from "../controllers/forms.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("forms"));

router.get("/", listForms);
router.post("/", requireOrganizationRole(["owner", "admin"]), createForm);
router.get("/:id", getForm);
router.put("/:id", requireOrganizationRole(["owner", "admin"]), updateForm);
router.post("/:id/duplicate", requireOrganizationRole(["owner", "admin"]), duplicateForm);
router.delete("/:id", requireOrganizationRole(["owner", "admin"]), archiveForm);
router.get("/:id/submissions", listSubmissions);
router.get("/:id/submissions/export", exportSubmissionsCsv);
router.put(
  "/:id/submissions/:submissionId",
  requireOrganizationRole(["owner", "admin"]),
  updateSubmissionStatus
);

export default router;
