import { Router } from "express";
import {
  archiveSupportTicket,
  createTicketCustomer,
  deleteSupportTicket,
  getCustomerCandidates,
  getRelatedTickets,
  getSupportTicket,
  listSupportTickets,
  reopenSupportTicket,
  resolveSupportTicket,
  unarchiveSupportTicket,
  updateTicketCustomer,
} from "../controllers/ticket.controller";
import {
  approveTicketAiDraft as approveSupportAiDraft,
  createTicketAiDraft as createSupportAiDraft,
  rejectTicketAiDraft as rejectSupportAiDraft,
  updateTicketAiMode as updateSupportTicketAiMode,
} from "../controllers/support-ai.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("support"));
router.use(requireEmployeeModule("support"));

router.get("/", listSupportTickets);
router.get("/:id", getSupportTicket);
router.get("/:id/related", getRelatedTickets);
router.get("/:id/customer-candidates", getCustomerCandidates);
router.patch("/:id/customer", updateTicketCustomer);
router.post("/:id/customer", createTicketCustomer);
router.patch("/:id/ai-mode", updateSupportTicketAiMode);
router.post("/:id/ai-drafts", createSupportAiDraft);
router.patch("/:id/ai-drafts/:draftId/approve", approveSupportAiDraft);
router.patch("/:id/ai-drafts/:draftId/reject", rejectSupportAiDraft);
router.patch("/:id/resolve", resolveSupportTicket);
router.patch("/:id/reopen", reopenSupportTicket);
router.patch("/:id/archive", archiveSupportTicket);
router.patch("/:id/unarchive", unarchiveSupportTicket);
router.delete("/:id", deleteSupportTicket);

export default router;
