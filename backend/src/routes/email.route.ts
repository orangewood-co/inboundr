import { Router } from "express";
import { emailWebhookController, listEmails, getEmail } from "../controllers/email.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.post("/webhook", emailWebhookController);
router.get("/", requireAuth, requireOrganization, listEmails);
router.get("/:id", requireAuth, requireOrganization, getEmail);

export default router;
