import { Router } from "express";

import {
  createTicketTag,
  deleteTicketTag,
  listTicketTags,
  updateTicketTag,
} from "../controllers/support-ticket-tag.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("support"));
router.use(requireEmployeeModule("support"));

router.get("/", listTicketTags);
router.post("/", requireOrganizationAdmin(), createTicketTag);
router.patch("/:id", requireOrganizationAdmin(), updateTicketTag);
router.delete("/:id", requireOrganizationAdmin(), deleteTicketTag);

export default router;
