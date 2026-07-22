import { Router } from "express";
import {
  archiveForm,
  createForm,
  deleteSubmission,
  duplicateForm,
  exportSubmissionsCsv,
  getForm,
  listForms,
  listSubmissions,
  saveSubmissionFileToDrive,
  updateForm,
  updateSubmissionStatus,
} from "../controllers/forms.controller";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../controllers/form-folders.controller";
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
router.use(requireFeature("forms"));
router.use(requireEmployeeModule("forms"));

router.get("/folders", listFolders);
router.post("/folders", requireOrganizationAdmin(), createFolder);
router.put("/folders/:folderId", requireOrganizationAdmin(), updateFolder);
router.delete("/folders/:folderId", requireOrganizationAdmin(), deleteFolder);

router.get("/", listForms);
router.post("/", requireOrganizationAdmin(), createForm);
router.get("/:id", getForm);
router.put("/:id", requireOrganizationAdmin(), updateForm);
router.post("/:id/duplicate", requireOrganizationAdmin(), duplicateForm);
router.delete("/:id", requireOrganizationAdmin(), archiveForm);
router.get("/:id/submissions", listSubmissions);
router.get("/:id/submissions/export", exportSubmissionsCsv);
router.post(
  "/:id/submissions/:submissionId/save-to-drive",
  requireFeature("drive"),
  requireEmployeeModule("drive"),
  saveSubmissionFileToDrive
);
router.put(
  "/:id/submissions/:submissionId",
  requireOrganizationAdmin(),
  updateSubmissionStatus
);
router.delete(
  "/:id/submissions/:submissionId",
  requireOrganizationAdmin(),
  deleteSubmission
);

export default router;
