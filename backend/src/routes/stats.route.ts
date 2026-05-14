import { Router } from "express";
import { getStatsOverview } from "../controllers/stats.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/overview", getStatsOverview);

export default router;
