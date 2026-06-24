import { Router } from "express";
import {
  acceptOrganizationInvitation,
  addOrganizationLetterhead,
  archiveOrganizationAccessGroup,
  cancelOrganizationInvitation,
  createOrganizationAccessGroup,
  deleteOrganizationLetterhead,
  getMyOrganization,
  inviteOrganizationMember,
  listOrganizationAccessGroups,
  listOrganizationInvitations,
  listOrganizationMembers,
  previewOrganizationInvitation,
  removeOrganizationMember,
  setActiveOrganizationLetterhead,
  transferOrganizationOwnership,
  updateOrganizationAccessGroup,
  updateOrganizationMemberAccessGroups,
  updateMyOrganization,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller";
import {
  requireAuth,
  requireOrganizationAdmin,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.get("/invitations/preview", previewOrganizationInvitation);
router.use(requireAuth);
router.post("/invitations/accept", acceptOrganizationInvitation);
router.use(requireOrganization);
router.get("/me", getMyOrganization);
router.put("/me", requireOrganizationAdmin(), updateMyOrganization);
router.get("/access-groups", requireOrganizationAdmin(), listOrganizationAccessGroups);
router.post("/access-groups", requireOrganizationAdmin(), createOrganizationAccessGroup);
router.put("/access-groups/:id", requireOrganizationAdmin(), updateOrganizationAccessGroup);
router.delete("/access-groups/:id", requireOrganizationAdmin(), archiveOrganizationAccessGroup);
router.post(
  "/letterheads",
  requireOrganizationAdmin(),
  addOrganizationLetterhead
);
router.patch(
  "/letterheads/:id/active",
  requireOrganizationAdmin(),
  setActiveOrganizationLetterhead
);
router.delete(
  "/letterheads/:id",
  requireOrganizationAdmin(),
  deleteOrganizationLetterhead
);
router.get("/members", listOrganizationMembers);
router.post(
  "/members/:id/transfer-ownership",
  requireOrganizationRole(["owner"]),
  transferOrganizationOwnership
);
router.patch(
  "/members/:id",
  requireOrganizationAdmin(),
  updateOrganizationMemberRole
);
router.patch(
  "/members/:id/access-groups",
  requireOrganizationAdmin(),
  updateOrganizationMemberAccessGroups
);
router.delete(
  "/members/:id",
  requireOrganizationAdmin(),
  removeOrganizationMember
);
router.get(
  "/invitations",
  requireOrganizationAdmin(),
  listOrganizationInvitations
);
router.post(
  "/invitations",
  requireOrganizationAdmin(),
  inviteOrganizationMember
);
router.delete(
  "/invitations/:id",
  requireOrganizationAdmin(),
  cancelOrganizationInvitation
);

export default router;
