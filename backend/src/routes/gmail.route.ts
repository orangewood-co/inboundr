import { Router } from "express";
import {
  connectGmail,
  disconnectGmailAccount,
  gmailCallback,
  listGmailAccounts,
} from "../controllers/gmail.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.get("/connect", requireAuth, requireOrganization, connectGmail);
router.get("/callback", gmailCallback);
router.get("/accounts", requireAuth, requireOrganization, listGmailAccounts);
router.delete("/accounts/:id", requireAuth, requireOrganization, disconnectGmailAccount);

export default router;
