import { Router } from "express";
import { emailWebhookController, listEmails, getEmail } from "../controllers/email.controller";

const router = Router();

router.post("/webhook", emailWebhookController);
router.get("/", listEmails);
router.get("/:id", getEmail);

export default router;
