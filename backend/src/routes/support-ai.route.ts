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
  getSupportCallSettings,
  getSupportResolutionReasons,
  getSupportSettings,
  updateSupportCallSettings,
  updateSupportResolutionReasons,
  updateSupportSettings,
} from "../controllers/support-settings.controller";
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
router.use(requireFeature("support"));
router.use(requireEmployeeModule("support"));

router.get("/settings", getSupportSettings);
router.patch("/settings", updateSupportSettings);
router.get("/resolution-reasons", getSupportResolutionReasons);
router.patch("/resolution-reasons", requireOrganizationAdmin(), updateSupportResolutionReasons);
router.get("/call/settings", getSupportCallSettings);
router.patch("/call/settings", updateSupportCallSettings);
router.get("/ai/settings", getSupportAiSettings);
router.patch("/ai/settings", updateSupportAiSettings);
router.get("/knowledge", listKnowledgeArticles);
router.post("/knowledge", createKnowledgeArticle);
router.patch("/knowledge/:id", updateKnowledgeArticle);
router.delete("/knowledge/:id", deleteKnowledgeArticle);

export default router;
