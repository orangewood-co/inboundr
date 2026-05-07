import { Router } from "express";
import { emailWebhookController, listEmails, getEmail } from "../controllers/email.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/webhook", emailWebhookController);
router.get("/", requireAuth, listEmails);
router.get("/:id", requireAuth, getEmail);

export default router;
