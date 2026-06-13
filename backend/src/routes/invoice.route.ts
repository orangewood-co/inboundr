import { Router } from "express";
import {
  cancelInvoice,
  createInvoice,
  duplicateInvoice,
  downloadInvoicePdf,
  getInvoice,
  getInvoiceStats,
  getReceivables,
  listInvoices,
  markInvoiceViewed,
  recordInvoicePayment,
  sendInvoice,
  setInvoiceReminders,
  updateInvoice,
  writeOffInvoice,
} from "../controllers/invoice.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("invoices"));
router.use(requireEmployeeModule("invoices"));

router.get("/", listInvoices);
router.get("/stats", getInvoiceStats);
router.get("/receivables", getReceivables);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.put("/:id", updateInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/viewed", markInvoiceViewed);
router.post("/:id/payments", recordInvoicePayment);
router.post("/:id/reminders", setInvoiceReminders);
router.post("/:id/cancel", cancelInvoice);
router.post("/:id/write-off", writeOffInvoice);
router.post("/:id/duplicate", duplicateInvoice);
router.get("/:id/pdf", downloadInvoicePdf);

export default router;
