import { Router } from "express";
import {
  getCall,
  getCallRecordingUrl,
  getVoiceAgentSettings,
  listCalls,
  updateVoiceAgentSettings,
} from "../controllers/calls.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("calls"));

router.get("/", listCalls);
router.get("/agent-settings", getVoiceAgentSettings);
router.put("/agent-settings", updateVoiceAgentSettings);
router.get("/:id", getCall);
router.get("/:id/recording", getCallRecordingUrl);

export default router;
