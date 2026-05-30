import { Router } from "express";
import {
  downloadEmailPdf,
  emailWebhookController,
  getEmail,
  getEmailAttachment,
  listEmails,
} from "../controllers/email.controller";
import { requireAuth, requireEmployeeModule, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.post("/webhook", emailWebhookController);
router.get("/", requireAuth, requireOrganization, requireEmployeeModule("inbox"), listEmails);
router.get(
  "/:id/attachments/:attachmentId",
  requireAuth,
  requireOrganization,
  requireEmployeeModule("inbox"),
  getEmailAttachment
);
router.get(
  "/:id/attachments/:attachmentId/download",
  requireAuth,
  requireOrganization,
  requireEmployeeModule("inbox"),
  getEmailAttachment
);
router.get("/:id/pdf", requireAuth, requireOrganization, requireEmployeeModule("inbox"), downloadEmailPdf);
router.get("/:id", requireAuth, requireOrganization, requireEmployeeModule("inbox"), getEmail);

export default router;
