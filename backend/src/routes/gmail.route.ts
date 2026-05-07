import { Router } from "express";
import {
  connectGmail,
  disconnectGmailAccount,
  gmailCallback,
  listGmailAccounts,
} from "../controllers/gmail.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/connect", requireAuth, connectGmail);
router.get("/callback", gmailCallback);
router.get("/accounts", requireAuth, listGmailAccounts);
router.delete("/accounts/:id", requireAuth, disconnectGmailAccount);

export default router;
