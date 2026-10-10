import { Router } from "express";
import {
  createEmailDraft,
  createTicketFromEmail,
  deleteEmailDraft,
  downloadEmailPdf,
  emailWebhookController,
  generateEmailReply,
  getEmail,
  getEmailAttachment,
  getEmailThread,
  listEmails,
  reprocessEmail,
  sendEmailDraft,
  syncEmailThread,
  updateEmailDraft,
} from "../controllers/email.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

const requireInbox = [
  requireAuth,
  requireOrganization,
  requireFeature("rfq"),
  requireEmployeeModule("rfq"),
];

router.post("/webhook", emailWebhookController);
router.get("/", ...requireInbox, listEmails);
router.get("/:id/attachments/:attachmentId", ...requireInbox, getEmailAttachment);
router.get("/:id/attachments/:attachmentId/download", ...requireInbox, getEmailAttachment);
router.get("/:id/pdf", ...requireInbox, downloadEmailPdf);
router.post("/:id/reprocess", ...requireInbox, reprocessEmail);
router.post(
  "/:id/ticket",
  ...requireInbox,
  requireFeature("support"),
  requireEmployeeModule("support"),
  createTicketFromEmail
);

router.get("/:id/thread", ...requireInbox, getEmailThread);
router.post("/:id/thread/sync", ...requireInbox, syncEmailThread);
router.post("/:id/drafts", ...requireInbox, createEmailDraft);
router.patch("/drafts/:draftId", ...requireInbox, updateEmailDraft);
router.delete("/drafts/:draftId", ...requireInbox, deleteEmailDraft);
router.post("/drafts/:draftId/send", ...requireInbox, sendEmailDraft);
router.post("/drafts/:draftId/generate", ...requireInbox, generateEmailReply);

router.get("/:id", ...requireInbox, getEmail);

export default router;
