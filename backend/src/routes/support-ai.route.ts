import { Router } from "express";

import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getSupportAiSettings,
  listKnowledgeArticles,
  updateKnowledgeArticle,
  updateSupportAiSettings,
} from "../controllers/support-ai.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("support"));
router.use(requireEmployeeModule("support"));

router.get("/ai/settings", getSupportAiSettings);
router.patch("/ai/settings", updateSupportAiSettings);
router.get("/knowledge", listKnowledgeArticles);
router.post("/knowledge", createKnowledgeArticle);
router.patch("/knowledge/:id", updateKnowledgeArticle);
router.delete("/knowledge/:id", deleteKnowledgeArticle);

export default router;
