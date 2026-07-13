import { Router } from "express";
import {
  addNote,
  applicationRanking,
  applicationEmployeeHandoff,
  approveJobRubric,
  changeJobStatus,
  createApplicationHandler,
  createCandidateHandler,
  createJob,
  dashboard,
  deleteJob,
  deleteApplication,
  deleteCandidate,
  getApplication,
  getCandidate,
  getJob,
  getJobPipeline,
  getSettings,
  generateJobRubric,
  listApplications,
  listActivity,
  listCandidates,
  listJobs,
  listNotes,
  moveApplication,
  listJobRubrics,
  presignAttachment,
  presignBanner,
  saveAttachment,
  saveBanner,
  editJobRubric,
  regenerateJobRubric,
  rerankAllJobApplications,
  rerankApplicationHandler,
  rerankBatchProgress,
  retryApplicationRankingHandler,
  updateJob,
  updateSettings,
  viewAttachment,
} from "../controllers/recruitment.controller";
import {
  recruitmentRerankLimiter,
  recruitmentRubricGenerationLimiter,
} from "../middleware/rate-limit.middleware";
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
router.use(requireFeature("recruitment"));
router.use(requireEmployeeModule("recruitment"));

router.get("/settings", getSettings);
router.put("/settings", requireOrganizationAdmin(), updateSettings);
router.post("/settings/banner/presign", requireOrganizationAdmin(), presignBanner);
router.post("/settings/banner", requireOrganizationAdmin(), saveBanner);
router.get("/dashboard", dashboard);
router.get("/activity", listActivity);

router.get("/jobs", listJobs);
router.post("/jobs", requireOrganizationAdmin(), createJob);
router.get("/jobs/:id/pipeline", getJobPipeline);
router.patch("/jobs/:id/status", requireOrganizationAdmin(), changeJobStatus);
router.get("/jobs/:id/rubrics", listJobRubrics);
router.post(
  "/jobs/:id/rubrics/generate",
  requireOrganizationAdmin(),
  recruitmentRubricGenerationLimiter,
  generateJobRubric
);
router.post(
  "/jobs/:id/rubrics/regenerate",
  requireOrganizationAdmin(),
  recruitmentRubricGenerationLimiter,
  regenerateJobRubric
);
router.patch("/jobs/:id/rubrics/:rubricId", requireOrganizationAdmin(), editJobRubric);
router.post("/jobs/:id/rubrics/:rubricId/approve", requireOrganizationAdmin(), approveJobRubric);
router.post(
  "/jobs/:id/rerank-all",
  requireOrganizationAdmin(),
  recruitmentRerankLimiter,
  rerankAllJobApplications
);
router.get("/ranking-batches/:batchId", rerankBatchProgress);
router.get("/jobs/:id", getJob);
router.patch("/jobs/:id", requireOrganizationAdmin(), updateJob);
router.delete("/jobs/:id", requireOrganizationAdmin(), deleteJob);

router.get("/candidates", listCandidates);
router.post("/candidates", createCandidateHandler);
router.get("/candidates/:id", getCandidate);
router.delete("/candidates/:id", requireOrganizationAdmin(), deleteCandidate);

router.get("/applications", listApplications);
router.post("/applications", createApplicationHandler);
router.get("/applications/:id", getApplication);
router.get("/applications/:id/employee-handoff", applicationEmployeeHandoff);
router.delete("/applications/:id", requireOrganizationAdmin(), deleteApplication);
router.get("/applications/:id/ranking", applicationRanking);
router.post(
  "/applications/:id/ranking/retry",
  requireOrganizationAdmin(),
  recruitmentRerankLimiter,
  retryApplicationRankingHandler
);
router.post(
  "/applications/:id/ranking/rerank",
  requireOrganizationAdmin(),
  recruitmentRerankLimiter,
  rerankApplicationHandler
);
router.patch("/applications/:id/stage", moveApplication);
router.get("/applications/:id/notes", listNotes);
router.post("/applications/:id/notes", addNote);
router.post("/applications/:id/attachments/presign", presignAttachment);
router.post("/applications/:id/attachments", saveAttachment);
router.get("/applications/:id/attachments/:attachmentId/view", viewAttachment);

export default router;
