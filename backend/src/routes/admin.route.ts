import { Router } from "express";
import {
  cancelAdminOrganizationInvitation,
  addAdminUserMembership,
  createAdminOrganization,
  getAdminMe,
  getAdminOrganization,
  getAdminPlans,
  inviteAdminOrganizationMember,
  listAdminOrganizations,
  listAdminUsers,
  moveAdminOrganizationMember,
  removeAdminOrganizationMember,
  sendAdminSampleNotification,
  transferAdminOrganizationOwner,
  updateAdminOrganizationMember,
  updateAdminOrganization,
} from "../controllers/admin.controller";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/me", getAdminMe);
router.use(requireSuperAdmin);
router.get("/plans", getAdminPlans);
router.get("/organizations", listAdminOrganizations);
router.get("/users", listAdminUsers);
router.post("/notifications/sample", sendAdminSampleNotification);
router.post("/users/:userId/memberships", addAdminUserMembership);
router.post("/organizations", createAdminOrganization);
router.get("/organizations/:id", getAdminOrganization);
router.patch("/organizations/:id", updateAdminOrganization);
router.post("/organizations/:id/invitations", inviteAdminOrganizationMember);
router.delete("/organizations/:id/invitations/:invitationId", cancelAdminOrganizationInvitation);
router.patch("/organizations/:id/members/:memberId", updateAdminOrganizationMember);
router.delete("/organizations/:id/members/:memberId", removeAdminOrganizationMember);
router.post("/organizations/:id/members/:memberId/move", moveAdminOrganizationMember);
router.post("/organizations/:id/members/:memberId/transfer-owner", transferAdminOrganizationOwner);

export default router;
