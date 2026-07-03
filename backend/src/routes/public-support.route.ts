import { Router } from "express";
import {
  createSupportUploadPresign,
  endSupportSession,
  getSupportSession,
  getSupportWorkspace,
  postSupportSessionMessage,
  startSupportSession,
} from "../controllers/support-chat.controller";
import {
  publicReadLimiter,
  supportMessageLimiter,
  supportSessionEndLimiter,
  supportSessionStartLimiter,
  supportUploadLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/workspace/:organizationId", publicReadLimiter, getSupportWorkspace);
router.post("/session", supportSessionStartLimiter, startSupportSession);
router.get("/session/:token", publicReadLimiter, getSupportSession);
router.post("/session/:token/end", supportSessionEndLimiter, endSupportSession);
router.post("/session/:token/messages", supportMessageLimiter, postSupportSessionMessage);
router.post("/session/:token/uploads/presign", supportUploadLimiter, createSupportUploadPresign);

export default router;
