import { Router } from "express";
import {
  createChatThread,
  deleteChatThread,
  generateChatThreadTitle,
  getChatThread,
  listChatMessages,
  listChatThreads,
  saveChatMessage,
  streamChat,
  updateChatThread,
} from "../controllers/chat.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("chat"));
router.use(requireEmployeeModule("chat"));

router.post("/", streamChat);
router.get("/threads", listChatThreads);
router.post("/threads", createChatThread);
router.get("/threads/:id", getChatThread);
router.patch("/threads/:id", updateChatThread);
router.delete("/threads/:id", deleteChatThread);
router.post("/threads/:id/title", generateChatThreadTitle);
router.get("/threads/:id/messages", listChatMessages);
router.post("/threads/:id/messages", saveChatMessage);

export default router;
