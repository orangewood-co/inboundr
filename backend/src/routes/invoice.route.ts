import { Router } from "express";
import {
  cancelInvoice,
  createInvoice,
  duplicateInvoice,
  downloadInvoicePdf,
  getInvoice,
  getInvoicePreview,
  getInvoiceStats,
  listInvoices,
  markInvoiceViewed,
  recordInvoicePayment,
  sendInvoice,
  updateInvoice,
  writeOffInvoice,
} from "../controllers/invoice.controller";
import { requireAuth, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("invoices"));

router.get("/", listInvoices);
router.get("/stats", getInvoiceStats);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.put("/:id", updateInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/viewed", markInvoiceViewed);
router.post("/:id/payments", recordInvoicePayment);
router.post("/:id/cancel", cancelInvoice);
router.post("/:id/write-off", writeOffInvoice);
router.post("/:id/duplicate", duplicateInvoice);
router.get("/:id/preview", getInvoicePreview);
router.get("/:id/pdf", downloadInvoicePdf);

export default router;
