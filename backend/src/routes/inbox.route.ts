import { Router } from "express";

import {
  getConversation,
  processConversationRFQ,
  sendConversationMessage,
} from "../controllers/inbox.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

/**
 * Non-email Inbox conversations (WhatsApp chats on the RFQ number). The list
 * itself is served by GET /email alongside email threads.
 */
const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("rfq"));
router.use(requireEmployeeModule("rfq"));

router.get("/conversations/:id", getConversation);
router.post("/conversations/:id/messages", sendConversationMessage);
router.post("/conversations/:id/rfq", processConversationRFQ);

export default router;
