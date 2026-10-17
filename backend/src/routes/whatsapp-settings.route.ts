import { Router } from "express";

import {
  disconnectWhatsApp,
  forWhatsAppPurpose,
  getWhatsAppSettings,
  syncWhatsAppTemplatesForOrganization,
  updateWhatsAppSettings,
} from "../controllers/whatsapp-settings.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

/**
 * Organization-level WhatsApp connections (Settings → Integrations). The
 * support number is not gated on a single feature because support, invoices
 * and reminders all consume it; each consumer enforces its own feature at use
 * time. The RFQ number only exists for Quotations.
 */
const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireOrganizationAdmin());

const rfqRouter = Router();
rfqRouter.use(requireFeature("rfq"), forWhatsAppPurpose("rfq"));
rfqRouter.get("/", getWhatsAppSettings);
rfqRouter.patch("/", updateWhatsAppSettings);
rfqRouter.delete("/", disconnectWhatsApp);
rfqRouter.post("/templates/sync", syncWhatsAppTemplatesForOrganization);
router.use("/rfq", rfqRouter);

router.use(forWhatsAppPurpose("primary"));
router.get("/", getWhatsAppSettings);
router.patch("/", updateWhatsAppSettings);
router.delete("/", disconnectWhatsApp);
router.post("/templates/sync", syncWhatsAppTemplatesForOrganization);

export default router;
