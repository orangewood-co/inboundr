import { Router } from "express";
import {
  connectGmail,
  disconnectGmailAccount,
  gmailCallback,
  listGmailAccounts,
} from "../controllers/gmail.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/connect",
  requireAuth,
  requireOrganization,
  requireFeature("rfq"),
  requireOrganizationAdmin(),
  connectGmail
);
router.get("/callback", gmailCallback);
router.get("/accounts", requireAuth, requireOrganization, requireFeature("rfq"), listGmailAccounts);
router.delete(
  "/accounts/:id",
  requireAuth,
  requireOrganization,
  requireFeature("rfq"),
  requireOrganizationAdmin(),
  disconnectGmailAccount
);

export default router;
