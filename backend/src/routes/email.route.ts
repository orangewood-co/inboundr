import { Router } from "express";
import {
  emailWebhookController,
  getEmail,
  getEmailAttachment,
  listEmails,
} from "../controllers/email.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.post("/webhook", emailWebhookController);
router.get("/", requireAuth, requireOrganization, listEmails);
router.get(
  "/:id/attachments/:attachmentId",
  requireAuth,
  requireOrganization,
  getEmailAttachment
);
router.get(
  "/:id/attachments/:attachmentId/download",
  requireAuth,
  requireOrganization,
  getEmailAttachment
);
router.get("/:id", requireAuth, requireOrganization, getEmail);

export default router;
