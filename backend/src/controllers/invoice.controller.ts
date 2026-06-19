import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Invoice, type InvoiceStatus } from "../models/invoice.model";
import { GmailAccount } from "../models/gmail-account.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { sendStandaloneEmail } from "../services/gmail-send.service";
import {
  InvoiceServiceError,
  calculateTotals,
  createInvoiceRecord,
  nextInvoiceNumber,
  normalizePaymentMethod,
  parseInvoiceDate,
  resolveInvoiceUpiId,
  resolveStatus,
  roundMoney,
  searchInvoiceRecords,
  toNumber,
  updateDraftInvoiceRecord,
} from "../services/invoice.service";
import {
  buildInvoiceUpiAssets,
  renderInvoicePdfBuffer,
  streamInvoicePdf,
} from "../services/invoice-pdf.service";
import { resolveOrganizationPdfBranding } from "../services/organization-pdf-branding.service";

const ACTIVE_STATUSES = new Set<InvoiceStatus>(["sent", "viewed", "partially_paid", "overdue"]);

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function invoiceServiceErrorStatus(error: InvoiceServiceError): number {
  if (error.code === "not_found") return 404;
  return 400;
}

function renderInvoiceEmail(invoice: any, upiId = ""): string {
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  return [
    `Hello ${invoice.customerSnapshot.name || invoice.customerSnapshot.company || "there"},`,
    "",
    `Please find invoice ${invoice.invoiceNumber} from ${invoice.organizationSnapshot.name}.`,
    `Amount due: ${money.format(invoice.totals.balanceDue)}`,
    invoice.dueDate ? `Due date: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(invoice.dueDate))}` : "",
    upiId && invoice.totals.balanceDue > 0 ? `Pay via UPI: ${upiId}` : "",
    "",
    "The invoice PDF is attached to this email.",
    "",
    invoice.notes || "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}


export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const result = await searchInvoiceRecords({
      organizationId: orgReq.organization._id,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 20, 50),
      query: String(req.query.search ?? ""),
      status: String(req.query.status ?? ""),
      customerId: String(req.query.customerId ?? ""),
      outstandingOnly: req.query.outstandingOnly === "1" || req.query.outstandingOnly === "true",
    });

    res.json(result);
  } catch (err) {
    console.error("Error listing invoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
};

export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid invoice id" });
      return;
    }

    const invoice = await Invoice.findOne({ _id: id, organizationId: orgReq.organization._id }).lean();
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    res.json(invoice);
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
};

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const invoice = await createInvoiceRecord(orgReq.organization, body);

    res.status(201).json(invoice);
  } catch (err: any) {
    if (err instanceof InvoiceServiceError) {
      res.status(invoiceServiceErrorStatus(err)).json({ error: err.message });
      return;
    }
    console.error("Error creating invoice:", err);
    res.status(err?.code === 11000 ? 409 : 500).json({
      error: err?.code === 11000 ? "Invoice number already exists" : "Failed to create invoice",
    });
  }
};

export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const invoice = await updateDraftInvoiceRecord(orgReq.organization, id, body);

    res.json(invoice);
  } catch (err: any) {
    if (err instanceof InvoiceServiceError) {
      res.status(invoiceServiceErrorStatus(err)).json({ error: err.message });
      return;
    }
    console.error("Error updating invoice:", err);
    res.status(err?.code === 11000 ? 409 : 500).json({
      error: err?.code === 11000 ? "Invoice number already exists" : "Failed to update invoice",
    });
  }
};

export const sendInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    if (invoice.lineItems.length === 0) {
      res.status(400).json({ error: "Invoice must have line items before sending" });
      return;
    }

    let gmailMessageId: string | null = null;
    if (invoice.customerSnapshot.email) {
      const account = await GmailAccount.findOne({
        organizationId: orgReq.organization._id,
        userId: orgReq.user.id,
        status: "connected",
      }).sort({ updatedAt: -1 });

      if (account) {
        const branding = await resolveOrganizationPdfBranding(orgReq.organization);
        const assets = await buildInvoiceUpiAssets(invoice, orgReq.organization);
        const pdf = await renderInvoicePdfBuffer(invoice, branding, assets);
        gmailMessageId = await sendStandaloneEmail({
          account,
          to: invoice.customerSnapshot.email,
          subject: `Invoice ${invoice.invoiceNumber} from ${invoice.organizationSnapshot.name}`,
          body: renderInvoiceEmail(invoice, assets?.upiQr?.upiId ?? resolveInvoiceUpiId(invoice, orgReq.organization)),
          attachments: [
            {
              filename: `${invoice.invoiceNumber}.pdf`,
              contentType: "application/pdf",
              content: pdf,
            },
          ],
        });
      }
    }

    invoice.status = "sent";
    invoice.sentAt = new Date();
    await invoice.save();
    res.json({ ...invoice.toObject(), gmailMessageId });
  } catch (err) {
    console.error("Error sending invoice:", err);
    res.status(500).json({ error: "Failed to send invoice" });
  }
};

export const markInvoiceViewed = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    if (ACTIVE_STATUSES.has(invoice.status)) invoice.status = "viewed";
    invoice.viewedAt = new Date();
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error("Error marking invoice viewed:", err);
    res.status(500).json({ error: "Failed to update invoice" });
  }
};

export const recordInvoicePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const amount = Math.max(0, toNumber(body.amount));
    if (amount <= 0) {
      res.status(400).json({ error: "Payment amount must be greater than zero" });
      return;
    }

    invoice.payments.push({
      amount,
      date: parseInvoiceDate(body.date) ?? new Date(),
      method: normalizePaymentMethod(body.method),
      reference: String(body.reference ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
    });
    invoice.totals = calculateTotals(invoice.lineItems, invoice.payments);
    invoice.status = resolveStatus(invoice.status, invoice.totals, invoice.dueDate);
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error("Error recording invoice payment:", err);
    res.status(500).json({ error: "Failed to record payment" });
  }
};

export const setInvoiceReminders = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    invoice.remindersEnabled = Boolean((req.body ?? {}).enabled);
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error("Error updating invoice reminders:", err);
    res.status(500).json({ error: "Failed to update invoice reminders" });
  }
};

export const cancelInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    invoice.status = "cancelled";
    invoice.cancelledAt = new Date();
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error("Error cancelling invoice:", err);
    res.status(500).json({ error: "Failed to cancel invoice" });
  }
};

export const writeOffInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await mutateInvoice(req, res);
    if (!invoice) return;
    invoice.status = "written_off";
    invoice.writtenOffAt = new Date();
    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error("Error writing off invoice:", err);
    res.status(500).json({ error: "Failed to write off invoice" });
  }
};

export const duplicateInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const source = await findInvoice(req);
    if (!source) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const copy = await Invoice.create({
      ...source.toObject(),
      _id: undefined,
      invoiceNumber: await nextInvoiceNumber(orgReq.organization._id),
      status: "draft",
      issueDate: new Date(),
      dueDate: null,
      payments: [],
      reminders: [],
      totals: calculateTotals(source.lineItems, []),
      sentAt: null,
      viewedAt: null,
      cancelledAt: null,
      writtenOffAt: null,
      archivedAt: null,
      createdAt: undefined,
      updatedAt: undefined,
    });

    res.status(201).json(copy);
  } catch (err) {
    console.error("Error duplicating invoice:", err);
    res.status(500).json({ error: "Failed to duplicate invoice" });
  }
};

export const downloadInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const invoice = await findInvoice(req, true);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const branding = await resolveOrganizationPdfBranding(orgReq.organization);
    const assets = await buildInvoiceUpiAssets(invoice, orgReq.organization);
    await streamInvoicePdf(invoice, branding, res, { inline: req.query.inline === "1", assets });
  } catch (err) {
    console.error("Error rendering invoice PDF:", err);
    res.status(500).json({ error: "Failed to render invoice PDF" });
  }
};

const AGING_EXCLUDED_STATUSES = new Set<InvoiceStatus>(["draft", "cancelled", "written_off", "paid"]);
const DAY_MS = 86_400_000;

type AgingBucket = "current" | "d1_15" | "d16_30" | "d31_45" | "d45plus";

function agingBucketOf(dueDate: Date | null | undefined, now: Date): AgingBucket {
  if (!dueDate) return "current";
  const days = Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY_MS);
  if (days <= 0) return "current";
  if (days <= 15) return "d1_15";
  if (days <= 30) return "d16_30";
  if (days <= 45) return "d31_45";
  return "d45plus";
}

type ReceivablesCustomer = {
  key: string;
  customerId: string | null;
  name: string;
  company: string;
  email: string;
  outstanding: number;
  overdue: number;
  aging: Record<AgingBucket, number>;
  invoiceCount: number;
  oldestDueDate: Date | null;
};

export const getReceivables = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const invoices = await Invoice.find({
      organizationId: orgReq.organization._id,
      status: { $nin: [...AGING_EXCLUDED_STATUSES] },
      "totals.balanceDue": { $gt: 0 },
    }).lean();
    const now = new Date();

    const groups = new Map<string, ReceivablesCustomer>();
    for (const invoice of invoices) {
      const snapshot = invoice.customerSnapshot ?? ({} as typeof invoice.customerSnapshot);
      const key = invoice.customerId
        ? String(invoice.customerId)
        : `snapshot:${(snapshot.email || snapshot.company || snapshot.name || "unknown").toLowerCase()}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          customerId: invoice.customerId ? String(invoice.customerId) : null,
          name: snapshot.name ?? "",
          company: snapshot.company ?? "",
          email: snapshot.email ?? "",
          outstanding: 0,
          overdue: 0,
          aging: { current: 0, d1_15: 0, d16_30: 0, d31_45: 0, d45plus: 0 },
          invoiceCount: 0,
          oldestDueDate: null,
        };
        groups.set(key, group);
      }

      const balance = invoice.totals.balanceDue;
      const bucket = agingBucketOf(invoice.dueDate, now);
      group.outstanding = roundMoney(group.outstanding + balance);
      group.invoiceCount += 1;
      group.aging[bucket] = roundMoney(group.aging[bucket] + balance);

      if (invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate);
        if (dueDate < now) group.overdue = roundMoney(group.overdue + balance);
        if (!group.oldestDueDate || dueDate < group.oldestDueDate) group.oldestDueDate = dueDate;
      }

      if (!group.name && snapshot.name) group.name = snapshot.name;
      if (!group.company && snapshot.company) group.company = snapshot.company;
      if (!group.email && snapshot.email) group.email = snapshot.email;
    }

    const customers = [...groups.values()].sort((a, b) => b.outstanding - a.outstanding);

    res.json({
      summary: {
        outstanding: roundMoney(customers.reduce((sum, customer) => sum + customer.outstanding, 0)),
        overdue: roundMoney(customers.reduce((sum, customer) => sum + customer.overdue, 0)),
        customerCount: customers.length,
        invoiceCount: invoices.length,
      },
      customers,
    });
  } catch (err) {
    console.error("Error fetching receivables:", err);
    res.status(500).json({ error: "Failed to fetch receivables" });
  }
};

export const getInvoiceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const invoices = await Invoice.find({ organizationId: orgReq.organization._id }).lean();
    const now = new Date();
    const outstanding = invoices.filter((invoice) => invoice.totals.balanceDue > 0);

    const aging = { current: 0, d1_15: 0, d16_30: 0, d31_45: 0, d45plus: 0 };
    for (const invoice of outstanding) {
      if (AGING_EXCLUDED_STATUSES.has(invoice.status)) continue;
      const bucket = agingBucketOf(invoice.dueDate, now);
      aging[bucket] = roundMoney(aging[bucket] + invoice.totals.balanceDue);
    }

    const monthly: Array<{ key: string; label: string; invoiced: number; collected: number }> = [];
    const monthIndex = new Map<string, number>();
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
      monthIndex.set(key, monthly.length);
      monthly.push({ key, label, invoiced: 0, collected: 0 });
    }

    const monthKey = (value: Date | string) => {
      const date = new Date(value);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    for (const invoice of invoices) {
      if (invoice.status !== "cancelled" && invoice.status !== "written_off") {
        const index = monthIndex.get(monthKey(invoice.issueDate));
        const month = index === undefined ? undefined : monthly[index];
        if (month) {
          month.invoiced = roundMoney(month.invoiced + invoice.totals.grandTotal);
        }
      }
      for (const payment of invoice.payments) {
        const index = monthIndex.get(monthKey(payment.date));
        const month = index === undefined ? undefined : monthly[index];
        if (month) {
          month.collected = roundMoney(month.collected + Math.max(0, payment.amount));
        }
      }
    }

    res.json({
      totalInvoiced: roundMoney(invoices.reduce((sum, invoice) => sum + invoice.totals.grandTotal, 0)),
      outstanding: roundMoney(outstanding.reduce((sum, invoice) => sum + invoice.totals.balanceDue, 0)),
      overdue: roundMoney(
        outstanding
          .filter((invoice) => invoice.dueDate && new Date(invoice.dueDate) < now)
          .reduce((sum, invoice) => sum + invoice.totals.balanceDue, 0)
      ),
      paidThisMonth: roundMoney(
        invoices.reduce(
          (sum, invoice) =>
            sum +
            invoice.payments
              .filter((payment) => {
                const date = new Date(payment.date);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              })
              .reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
          0
        )
      ),
      aging,
      monthly,
      countByStatus: invoices.reduce<Record<string, number>>((acc, invoice) => {
        acc[invoice.status] = (acc[invoice.status] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error("Error fetching invoice stats:", err);
    res.status(500).json({ error: "Failed to fetch invoice stats" });
  }
};

async function findInvoice(req: Request, lean = false) {
  const orgReq = req as OrganizationRequest;
  const id = String(req.params.id ?? "");
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const query = Invoice.findOne({ _id: id, organizationId: orgReq.organization._id });
  return lean ? query.lean() : query;
}

async function mutateInvoice(req: Request, res: Response) {
  const invoice = await findInvoice(req);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return null;
  }
  return invoice;
}
