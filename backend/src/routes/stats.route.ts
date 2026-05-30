import { Router } from "express";
import { getStatsOverview } from "../controllers/stats.controller";
import { requireAuth, requireEmployeeModule, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireEmployeeModule("stats"));
router.get("/overview", getStatsOverview);

export default router;
