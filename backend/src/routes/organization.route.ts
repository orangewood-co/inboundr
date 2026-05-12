import { Router } from "express";
import {
  getMyOrganization,
  updateMyOrganization,
} from "../controllers/organization.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/me", getMyOrganization);
router.put("/me", updateMyOrganization);

export default router;
