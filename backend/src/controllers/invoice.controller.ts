import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  Invoice,
  type IInvoiceLineItem,
  type InvoicePaymentMethod,
  type InvoiceRecurringFrequency,
  type InvoiceStatus,
} from "../models/invoice.model";
import { Customer } from "../models/customer.model";
import { GmailAccount } from "../models/gmail-account.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { sendStandaloneEmail } from "../services/gmail-send.service";

const ACTIVE_STATUSES = new Set<InvoiceStatus>(["sent", "viewed", "partially_paid", "overdue"]);
const LOCKED_STATUSES = new Set<InvoiceStatus>(["cancelled", "written_off", "paid"]);
const PAYMENT_METHODS = new Set<InvoicePaymentMethod>([
  "cash",
  "bank_transfer",
  "upi",
  "cheque",
  "card",
  "other",
]);
const RECURRING_FREQUENCIES = new Set<InvoiceRecurringFrequency>([
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
const TEMPLATES = new Set(["professional", "compact", "modern"]);
const SEARCH_FIELDS = [
  "invoiceNumber",
  "customerSnapshot.name",
  "customerSnapshot.company",
  "customerSnapshot.email",
  "poNumber",
] as const;

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeLineItems(items: unknown): IInvoiceLineItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const source = (item ?? {}) as Record<string, unknown>;
      const quantity = Math.max(0, toNumber(source.quantity, 1));
      const unitPrice = Math.max(0, toNumber(source.unitPrice));
      const discountPercentage = Math.min(100, Math.max(0, toNumber(source.discountPercentage)));
      const gstRate = Math.max(0, toNumber(source.gstRate));
      const gross = quantity * unitPrice;
      const discount = gross * (discountPercentage / 100);
      const taxableAmount = roundMoney(gross - discount);
      const taxAmount = roundMoney(taxableAmount * (gstRate / 100));

      return {
        productId: source.productId == null ? null : toNumber(source.productId),
        description: String(source.description ?? "").trim(),
        productCode: String(source.productCode ?? "").trim(),
        hsnCode: String(source.hsnCode ?? "").trim(),
        unit: String(source.unit ?? "").trim(),
        quantity,
        unitPrice,
        discountPercentage,
        gstRate,
        taxableAmount,
        taxAmount,
        totalAmount: roundMoney(taxableAmount + taxAmount),
      };
    })
    .filter((item) => item.description && item.quantity > 0);
}

function calculateTotals(lineItems: IInvoiceLineItem[], payments: { amount: number }[] = []) {
  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const taxableTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.taxableAmount, 0));
  const taxTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
  const grandTotal = roundMoney(taxableTotal + taxTotal);
  const paidTotal = roundMoney(payments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0));

  return {
    subtotal,
    discountTotal: roundMoney(subtotal - taxableTotal),
    taxableTotal,
    taxTotal,
    grandTotal,
    paidTotal,
    balanceDue: roundMoney(Math.max(0, grandTotal - paidTotal)),
  };
}

function resolveStatus(
  currentStatus: InvoiceStatus,
  totals: ReturnType<typeof calculateTotals>,
  dueDate: Date | null
): InvoiceStatus {
  if (LOCKED_STATUSES.has(currentStatus)) return currentStatus;
  if (totals.grandTotal > 0 && totals.balanceDue <= 0) return "paid";
  if (totals.paidTotal > 0) return "partially_paid";
  if (currentStatus !== "draft" && dueDate && dueDate < new Date()) return "overdue";
  return currentStatus;
}

async function nextInvoiceNumber(organizationId: mongoose.Types.ObjectId): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await Invoice.countDocuments({
    organizationId,
    invoiceNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function buildSnapshots(req: OrganizationRequest, body: Record<string, unknown>) {
  const organization = req.organization;
  const customerId = String(body.customerId ?? "");
  const customer =
    mongoose.Types.ObjectId.isValid(customerId)
      ? await Customer.findOne({ _id: customerId, organizationId: organization._id }).lean()
      : null;

  const customerSnapshotInput = (body.customerSnapshot ?? {}) as Record<string, unknown>;
  const customerSnapshot = {
    name: String(customerSnapshotInput.name ?? customer?.name ?? "").trim(),
    company: String(customerSnapshotInput.company ?? customer?.company ?? "").trim(),
    email: String(customerSnapshotInput.email ?? customer?.email ?? "").trim(),
    contactNumber: String(customerSnapshotInput.contactNumber ?? customer?.contactNumber ?? "").trim(),
    billingAddress: String(customerSnapshotInput.billingAddress ?? customer?.address ?? "").trim(),
    shippingAddress: String(customerSnapshotInput.shippingAddress ?? customer?.address ?? "").trim(),
  };

  return {
    customerId: customer?._id ?? null,
    customerSnapshot,
    organizationSnapshot: {
      name: organization.name ?? "",
      email: organization.defaultContact?.email ?? "",
      phoneNumber: organization.defaultContact?.phoneNumber ?? "",
      address: organization.address ?? "",
      logoUrl: organization.logoUrl ?? "",
      website: organization.website ?? "",
      primaryColor: organization.preferences?.primaryColor ?? "#f5b400",
    },
  };
}

function normalizeRecurring(body: Record<string, unknown>) {
  const recurring = (body.recurring ?? {}) as Record<string, unknown>;
  const frequency = String(recurring.frequency ?? "");
  return {
    enabled: Boolean(recurring.enabled),
    frequency: RECURRING_FREQUENCIES.has(frequency as InvoiceRecurringFrequency)
      ? (frequency as InvoiceRecurringFrequency)
      : null,
    startDate: parseDate(recurring.startDate),
    endDate: parseDate(recurring.endDate),
    nextRunDate: parseDate(recurring.nextRunDate),
    autoSend: Boolean(recurring.autoSend),
  };
}

function normalizePaymentMethod(value: unknown): InvoicePaymentMethod {
  const method = String(value ?? "bank_transfer");
  return PAYMENT_METHODS.has(method as InvoicePaymentMethod)
    ? (method as InvoicePaymentMethod)
    : "bank_transfer";
}

function normalizeTemplate(value: unknown): "professional" | "compact" | "modern" {
  const template = String(value ?? "professional");
  return TEMPLATES.has(template)
    ? (template as "professional" | "compact" | "modern")
    : "professional";
}

function renderInvoiceHtml(invoice: any): string {
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  const rows = invoice.lineItems
    .map(
      (item: IInvoiceLineItem) => `<tr>
        <td>${item.description}</td>
        <td>${item.hsnCode || "-"}</td>
        <td>${item.quantity}</td>
        <td>${money.format(item.unitPrice)}</td>
        <td>${item.discountPercentage}%</td>
        <td>${item.gstRate}%</td>
        <td>${money.format(item.totalAmount)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${invoice.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
        header { display: flex; justify-content: space-between; gap: 32px; border-bottom: 2px solid #111827; padding-bottom: 24px; }
        h1 { margin: 0; font-size: 32px; }
        table { width: 100%; border-collapse: collapse; margin-top: 32px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; }
        th { background: #f9fafb; text-transform: uppercase; letter-spacing: .04em; }
        .totals { margin-left: auto; margin-top: 24px; width: 320px; }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
        .grand { border-top: 2px solid #111827; font-weight: 700; font-size: 18px; }
      </style>
    </head>
    <body>
      <header>
        <div>
          <h1>Invoice</h1>
          <p><strong>${invoice.invoiceNumber}</strong></p>
          <p>Status: ${invoice.status}</p>
        </div>
        <div>
          <h2>${invoice.organizationSnapshot.name}</h2>
          <p>${invoice.organizationSnapshot.address || ""}</p>
          <p>${invoice.organizationSnapshot.email || ""}</p>
        </div>
      </header>
      <section>
        <h3>Bill To</h3>
        <p><strong>${invoice.customerSnapshot.company || invoice.customerSnapshot.name}</strong></p>
        <p>${invoice.customerSnapshot.name}</p>
        <p>${invoice.customerSnapshot.billingAddress || ""}</p>
        <p>${invoice.customerSnapshot.email || ""}</p>
      </section>
      <table>
        <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc.</th><th>GST</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="totals">
        <div><span>Subtotal</span><span>${money.format(invoice.totals.subtotal)}</span></div>
        <div><span>Discount</span><span>${money.format(invoice.totals.discountTotal)}</span></div>
        <div><span>Taxable</span><span>${money.format(invoice.totals.taxableTotal)}</span></div>
        <div><span>GST</span><span>${money.format(invoice.totals.taxTotal)}</span></div>
        <div class="grand"><span>Total</span><span>${money.format(invoice.totals.grandTotal)}</span></div>
        <div><span>Paid</span><span>${money.format(invoice.totals.paidTotal)}</span></div>
        <div><span>Balance</span><span>${money.format(invoice.totals.balanceDue)}</span></div>
      </section>
      <section><h3>Notes</h3><p>${invoice.notes || ""}</p><h3>Terms</h3><p>${invoice.termsAndConditions || ""}</p></section>
    </body>
  </html>`;
}

function renderInvoiceEmail(invoice: any): string {
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  return [
    `Hello ${invoice.customerSnapshot.name || invoice.customerSnapshot.company || "there"},`,
    "",
    `Please find invoice ${invoice.invoiceNumber} from ${invoice.organizationSnapshot.name}.`,
    `Amount due: ${money.format(invoice.totals.balanceDue)}`,
    invoice.dueDate ? `Due date: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(invoice.dueDate))}` : "",
    "",
    "You can preview or download the invoice from the app.",
    "",
    invoice.notes || "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const skip = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const filter: Record<string, unknown> = { organizationId: orgReq.organization._id };

    if (status && status !== "all") filter.status = status;
    if (search) {
      filter.$or = SEARCH_FIELDS.map((field) => ({ [field]: { $regex: search, $options: "i" } }));
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ issueDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);

    res.json({ invoices, total, page, limit, totalPages: Math.ceil(total / limit) });
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
    const lineItems = normalizeLineItems(body.lineItems);
    if (lineItems.length === 0) {
      res.status(400).json({ error: "At least one invoice line item is required" });
      return;
    }

    const snapshots = await buildSnapshots(orgReq, body);
    const payments = Array.isArray(body.payments) ? body.payments : [];
    const normalizedPayments = payments.map((payment) => ({
      amount: Math.max(0, toNumber((payment as any).amount)),
      date: parseDate((payment as any).date) ?? new Date(),
      method: normalizePaymentMethod((payment as any).method),
      reference: String((payment as any).reference ?? "").trim(),
      notes: String((payment as any).notes ?? "").trim(),
    }));
    const totals = calculateTotals(lineItems, normalizedPayments);
    const status = resolveStatus(String(body.status ?? "draft") as InvoiceStatus, totals, parseDate(body.dueDate));

    const invoice = await Invoice.create({
      organizationId: orgReq.organization._id,
      invoiceNumber: String(body.invoiceNumber ?? "").trim() || (await nextInvoiceNumber(orgReq.organization._id)),
      template: normalizeTemplate(body.template),
      status,
      issueDate: parseDate(body.issueDate) ?? new Date(),
      dueDate: parseDate(body.dueDate),
      paymentTerms: String(body.paymentTerms ?? orgReq.organization.preferences?.defaultTerms ?? "").trim(),
      poNumber: String(body.poNumber ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
      termsAndConditions: String(body.termsAndConditions ?? orgReq.organization.preferences?.defaultTerms ?? "").trim(),
      lineItems,
      payments: normalizedPayments,
      totals,
      recurring: normalizeRecurring(body),
      ...snapshots,
    });

    res.status(201).json(invoice);
  } catch (err: any) {
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid invoice id" });
      return;
    }

    const invoice = await Invoice.findOne({ _id: id, organizationId: orgReq.organization._id });
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (invoice.status !== "draft") {
      res.status(400).json({ error: "Only draft invoices can be edited" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const lineItems = "lineItems" in body ? normalizeLineItems(body.lineItems) : invoice.lineItems;
    if (lineItems.length === 0) {
      res.status(400).json({ error: "At least one invoice line item is required" });
      return;
    }

    const snapshots = await buildSnapshots(orgReq, body);
    invoice.set({
      invoiceNumber: String(body.invoiceNumber ?? invoice.invoiceNumber).trim(),
      template: normalizeTemplate(body.template ?? invoice.template),
      issueDate: parseDate(body.issueDate) ?? invoice.issueDate,
      dueDate: "dueDate" in body ? parseDate(body.dueDate) : invoice.dueDate,
      paymentTerms: String(body.paymentTerms ?? invoice.paymentTerms).trim(),
      poNumber: String(body.poNumber ?? invoice.poNumber).trim(),
      notes: String(body.notes ?? invoice.notes).trim(),
      termsAndConditions: String(body.termsAndConditions ?? invoice.termsAndConditions).trim(),
      lineItems,
      totals: calculateTotals(lineItems, invoice.payments),
      recurring: normalizeRecurring(body),
      ...snapshots,
    });
    invoice.status = resolveStatus(invoice.status, invoice.totals, invoice.dueDate);

    await invoice.save();
    res.json(invoice);
  } catch (err: any) {
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
        gmailMessageId = await sendStandaloneEmail({
          account,
          to: invoice.customerSnapshot.email,
          subject: `Invoice ${invoice.invoiceNumber} from ${invoice.organizationSnapshot.name}`,
          body: renderInvoiceEmail(invoice),
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
      date: parseDate(body.date) ?? new Date(),
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

export const getInvoicePreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await findInvoice(req, true);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderInvoiceHtml(invoice));
  } catch (err) {
    console.error("Error rendering invoice preview:", err);
    res.status(500).json({ error: "Failed to render invoice preview" });
  }
};

export const getInvoiceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const invoices = await Invoice.find({ organizationId: orgReq.organization._id }).lean();
    const now = new Date();
    const outstanding = invoices.filter((invoice) => invoice.totals.balanceDue > 0);

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
