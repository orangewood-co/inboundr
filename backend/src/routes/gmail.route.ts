import { Router } from "express";
import {
  connectGmail,
  disconnectGmailAccount,
  gmailCallback,
  listGmailAccounts,
  updateGmailPurpose,
  updateGmailSignature,
} from "../controllers/gmail.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

// Mailboxes feed both Quotations and Support (email tickets).
const requireMailboxFeature = requireFeature("rfq", "support");

router.get(
  "/connect",
  requireAuth,
  requireOrganization,
  requireMailboxFeature,
  requireOrganizationAdmin(),
  connectGmail
);
router.get("/callback", gmailCallback);
router.get("/accounts", requireAuth, requireOrganization, requireMailboxFeature, listGmailAccounts);
// A signature belongs to the connected identity, so its owner edits it without
// needing organization admin rights.
router.patch(
  "/accounts/:id/signature",
  requireAuth,
  requireOrganization,
  requireMailboxFeature,
  updateGmailSignature
);
router.patch(
  "/accounts/:id/purpose",
  requireAuth,
  requireOrganization,
  requireMailboxFeature,
  requireOrganizationAdmin(),
  updateGmailPurpose
);
router.delete(
  "/accounts/:id",
  requireAuth,
  requireOrganization,
  requireMailboxFeature,
  requireOrganizationAdmin(),
  disconnectGmailAccount
);

export default router;
