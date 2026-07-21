import { Router } from "express";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  handleApprovalDecision,
  listAllWorkflowRuns,
  listWorkflowRuns,
  listWorkflows,
  setWorkflowEnabled,
  updateWorkflow,
} from "../controllers/workflow.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
} from "../middleware/auth.middleware";

const router = Router();

// Public magic-link endpoint hit from approval emails — no session available.
router.get("/approval/:token/:decision", handleApprovalDecision);

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("workflows"));
router.use(requireEmployeeModule("rfq"));

router.get("/", listWorkflows);
router.post("/", createWorkflow);
// Must come before "/:id" so "runs" is not treated as a workflow id.
router.get("/runs", listAllWorkflowRuns);
router.get("/:id", getWorkflow);
router.put("/:id", updateWorkflow);
router.patch("/:id/enabled", setWorkflowEnabled);
router.delete("/:id", deleteWorkflow);
router.get("/:id/runs", listWorkflowRuns);

export default router;
