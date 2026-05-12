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
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get("/", listForms);
router.post("/", createForm);
router.get("/:id", getForm);
router.put("/:id", updateForm);
router.post("/:id/duplicate", duplicateForm);
router.delete("/:id", archiveForm);
router.get("/:id/submissions", listSubmissions);
router.get("/:id/submissions/export", exportSubmissionsCsv);
router.put("/:id/submissions/:submissionId", updateSubmissionStatus);

export default router;
