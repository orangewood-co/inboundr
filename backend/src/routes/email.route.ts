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
router.get("/", requireAuth, requireOrganization, requireFeature("inbox"), requireEmployeeModule("inbox"), listEmails);
router.get(
  "/:id/attachments/:attachmentId",
  requireAuth,
  requireOrganization,
  requireFeature("inbox"),
  requireEmployeeModule("inbox"),
  getEmailAttachment
);
router.get(
  "/:id/attachments/:attachmentId/download",
  requireAuth,
  requireOrganization,
  requireFeature("inbox"),
  requireEmployeeModule("inbox"),
  getEmailAttachment
);
router.get("/:id/pdf", requireAuth, requireOrganization, requireFeature("inbox"), requireEmployeeModule("inbox"), downloadEmailPdf);
router.post("/:id/reprocess", requireAuth, requireOrganization, requireFeature("inbox"), requireEmployeeModule("inbox"), requireFeature("rfq"), reprocessEmail);
router.get("/:id", requireAuth, requireOrganization, requireFeature("inbox"), requireEmployeeModule("inbox"), getEmail);

export default router;
