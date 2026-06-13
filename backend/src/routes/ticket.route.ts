import { Router } from "express";
import {
  getSupportTicket,
  listSupportTickets,
  reopenSupportTicket,
  resolveSupportTicket,
} from "../controllers/ticket.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get("/", listSupportTickets);
router.get("/:id", getSupportTicket);
router.patch("/:id/resolve", resolveSupportTicket);
router.patch("/:id/reopen", reopenSupportTicket);

export default router;
