import { Router } from "express";
import {
  getSupportSession,
  getSupportWorkspace,
  postSupportSessionMessage,
  startSupportSession,
} from "../controllers/support-chat.controller";

const router = Router();

router.get("/workspace/:organizationId", getSupportWorkspace);
router.post("/session", startSupportSession);
router.get("/session/:token", getSupportSession);
router.post("/session/:token/messages", postSupportSessionMessage);

export default router;
