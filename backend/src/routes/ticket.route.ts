import { Router } from "express";
import {
  createTicketCustomer,
  getCustomerCandidates,
  getRelatedTickets,
  getSupportTicket,
  listSupportTickets,
  reopenSupportTicket,
  resolveSupportTicket,
  updateTicketCustomer,
} from "../controllers/ticket.controller";
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
router.patch("/:id/resolve", resolveSupportTicket);
router.patch("/:id/reopen", reopenSupportTicket);

export default router;
