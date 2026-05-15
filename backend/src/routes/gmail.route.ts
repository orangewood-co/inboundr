import { Router } from "express";
import {
  connectGmail,
  disconnectGmailAccount,
  gmailCallback,
  listGmailAccounts,
} from "../controllers/gmail.controller";
import {
  requireAuth,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/connect",
  requireAuth,
  requireOrganization,
  requireOrganizationRole(["owner", "admin"]),
  connectGmail
);
router.get("/callback", gmailCallback);
router.get("/accounts", requireAuth, requireOrganization, listGmailAccounts);
router.delete(
  "/accounts/:id",
  requireAuth,
  requireOrganization,
  requireOrganizationRole(["owner", "admin"]),
  disconnectGmailAccount
);

export default router;
