import { Router } from "express";
import {
  createRun,
  getRun,
  getSettings,
  listRuns,
  selectCandidate,
  updateSettings,
} from "../controllers/procurement.controller";
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
router.use(requireFeature("procurement"));
router.use(requireEmployeeModule("rfq"));
router.get("/settings", getSettings);
router.put("/settings", requireOrganizationAdmin(), updateSettings);
router.get("/rfqs/:rfqId/runs", listRuns);
router.post("/rfqs/:rfqId/runs", createRun);
router.get("/runs/:runId", getRun);
router.post("/runs/:runId/select", selectCandidate);

export default router;
