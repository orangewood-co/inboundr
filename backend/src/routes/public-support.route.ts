import { Router } from "express";
import {
  createSupportUploadPresign,
  endSupportSession,
  getSupportSession,
  getSupportWorkspace,
  postSupportSessionMessage,
  startSupportSession,
} from "../controllers/support-chat.controller";

const router = Router();

router.get("/workspace/:organizationId", getSupportWorkspace);
router.post("/session", startSupportSession);
router.get("/session/:token", getSupportSession);
router.post("/session/:token/end", endSupportSession);
router.post("/session/:token/messages", postSupportSessionMessage);
router.post("/session/:token/uploads/presign", createSupportUploadPresign);

export default router;
