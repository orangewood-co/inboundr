import { Router } from "express";

import {
  getMyDashboardLayout,
  putMyDashboardLayout,
} from "../controllers/dashboard-layout.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/", getMyDashboardLayout);
router.put("/", putMyDashboardLayout);

export default router;
