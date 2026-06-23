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
router.get("/", requireAuth, requireOrganization, requireFeature("rfq"), requireEmployeeModule("rfq"), listEmails);
router.get(
  "/:id/attachments/:attachmentId",
  requireAuth,
  requireOrganization,
  requireFeature("rfq"),
  requireEmployeeModule("rfq"),
  getEmailAttachment
);
router.get(
  "/:id/attachments/:attachmentId/download",
  requireAuth,
  requireOrganization,
  requireFeature("rfq"),
  requireEmployeeModule("rfq"),
  getEmailAttachment
);
router.get("/:id/pdf", requireAuth, requireOrganization, requireFeature("rfq"), requireEmployeeModule("rfq"), downloadEmailPdf);
router.post("/:id/reprocess", requireAuth, requireOrganization, requireFeature("rfq"), requireEmployeeModule("rfq"), reprocessEmail);
router.get("/:id", requireAuth, requireOrganization, requireFeature("rfq"), requireEmployeeModule("rfq"), getEmail);

export default router;
