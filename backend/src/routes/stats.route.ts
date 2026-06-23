import { Router } from "express";
import { getStatsOverview } from "../controllers/stats.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("rfq"));
router.use(requireEmployeeModule("rfq"));
router.get("/overview", getStatsOverview);

export default router;
