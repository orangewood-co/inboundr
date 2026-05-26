import { Router } from "express";
import {
  createAdminOrganization,
  getAdminMe,
  getAdminOrganization,
  getAdminPlans,
  inviteAdminOrganizationMember,
  listAdminOrganizations,
  updateAdminOrganization,
} from "../controllers/admin.controller";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/me", getAdminMe);
router.use(requireSuperAdmin);
router.get("/plans", getAdminPlans);
router.get("/organizations", listAdminOrganizations);
router.post("/organizations", createAdminOrganization);
router.get("/organizations/:id", getAdminOrganization);
router.patch("/organizations/:id", updateAdminOrganization);
router.post("/organizations/:id/invitations", inviteAdminOrganizationMember);

export default router;
