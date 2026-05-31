import { Router } from "express";
import {
  acceptOrganizationInvitation,
  addOrganizationLetterhead,
  cancelOrganizationInvitation,
  deleteOrganizationLetterhead,
  getMyOrganization,
  inviteOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMembers,
  previewOrganizationInvitation,
  removeOrganizationMember,
  setActiveOrganizationLetterhead,
  updateMyOrganization,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller";
import {
  requireAuth,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.get("/invitations/preview", previewOrganizationInvitation);
router.use(requireAuth);
router.post("/invitations/accept", acceptOrganizationInvitation);
router.use(requireOrganization);
router.get("/me", getMyOrganization);
router.put("/me", requireOrganizationRole(["owner", "admin"]), updateMyOrganization);
router.post(
  "/letterheads",
  requireOrganizationRole(["owner", "admin"]),
  addOrganizationLetterhead
);
router.patch(
  "/letterheads/:id/active",
  requireOrganizationRole(["owner", "admin"]),
  setActiveOrganizationLetterhead
);
router.delete(
  "/letterheads/:id",
  requireOrganizationRole(["owner", "admin"]),
  deleteOrganizationLetterhead
);
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
