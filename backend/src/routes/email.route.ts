import { Router } from "express";
import {
  downloadEmailPdf,
  emailWebhookController,
  getEmail,
  getEmailAttachment,
  listEmails,
  reprocessEmail,
} from "../controllers/email.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

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
router.post("/:id/reprocess", requireAuth, requireOrganization, requireEmployeeModule("inbox"), requireFeature("rfq"), reprocessEmail);
router.get("/:id", requireAuth, requireOrganization, requireEmployeeModule("inbox"), getEmail);

export default router;
