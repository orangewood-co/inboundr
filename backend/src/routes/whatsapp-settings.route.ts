import { Router } from "express";

import {
  disconnectWhatsApp,
  getWhatsAppSettings,
  syncWhatsAppTemplatesForOrganization,
  updateWhatsAppSettings,
} from "../controllers/whatsapp-settings.controller";
import { requireAuth, requireOrganization, requireOrganizationAdmin } from "../middleware/auth.middleware";

/**
 * Organization-level WhatsApp connection (Settings → Integrations). Not gated
 * on a single feature because support, invoices and reminders all consume it;
 * each consumer enforces its own feature at use time.
 */
const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireOrganizationAdmin());

router.get("/", getWhatsAppSettings);
router.patch("/", updateWhatsAppSettings);
router.delete("/", disconnectWhatsApp);
router.post("/templates/sync", syncWhatsAppTemplatesForOrganization);

export default router;
