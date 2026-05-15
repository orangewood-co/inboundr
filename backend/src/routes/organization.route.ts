import { Router } from "express";
import {
  acceptOrganizationInvitation,
  cancelOrganizationInvitation,
  getMyOrganization,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMembers,
  removeOrganizationMember,
  updateMyOrganization,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller";
import {
  requireAuth,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.post("/invitations/accept", acceptOrganizationInvitation);
router.use(requireOrganization);
router.get("/me", getMyOrganization);
router.put("/me", requireOrganizationRole(["owner", "admin"]), updateMyOrganization);
router.get("/members", listOrganizationMembers);
router.patch(
  "/members/:id",
  requireOrganizationRole(["owner", "admin"]),
  updateOrganizationMemberRole
);
router.delete(
  "/members/:id",
  requireOrganizationRole(["owner", "admin"]),
  removeOrganizationMember
);
router.get(
  "/invitations",
  requireOrganizationRole(["owner", "admin"]),
  listOrganizationInvitations
);
router.post(
  "/invitations",
  requireOrganizationRole(["owner", "admin"]),
  inviteOrganizationMember
);
router.delete(
  "/invitations/:id",
  requireOrganizationRole(["owner", "admin"]),
  cancelOrganizationInvitation
);

export default router;
