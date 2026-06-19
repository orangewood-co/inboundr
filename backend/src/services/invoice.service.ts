import mongoose from "mongoose";

import { Customer } from "../models/customer.model";
import {
  Invoice,
  INVOICE_TEMPLATE_IDS,
  normalizeInvoiceTemplateId,
  type IInvoice,
  type IInvoiceLineItem,
  type IInvoicePayment,
  type InvoicePaymentMethod,
  type InvoiceRecurringFrequency,
  type InvoiceStatus,
  type InvoiceTemplateId,
} from "../models/invoice.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";

type InvoiceOrganization = OrganizationRequest["organization"];

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

export const INVOICE_SEARCH_FIELDS = [
  "invoiceNumber",
  "customerSnapshot.name",
  "customerSnapshot.company",
  "customerSnapshot.email",
  "poNumber",
] as const;

export type InvoiceServiceErrorCode = "validation" | "not_found" | "not_draft";

export class InvoiceServiceError extends Error {
  readonly code: InvoiceServiceErrorCode;

  constructor(code: InvoiceServiceErrorCode, message: string) {
    super(message);
    this.name = "InvoiceServiceError";
    this.code = code;
  }
}

export function parseInvoiceDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeLineItems(items: unknown): IInvoiceLineItem[] {
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

export function calculateTotals(lineItems: IInvoiceLineItem[], payments: { amount: number }[] = []) {
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

export function resolveInvoiceUpiId(
  invoice: { upiId?: string | null },
  organization: { preferences?: { defaultUpiId?: string } | null }
): string {
  return String(invoice.upiId || organization.preferences?.defaultUpiId || "").trim();
}

export function resolveStatus(
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

export async function nextInvoiceNumber(organizationId: mongoose.Types.ObjectId): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await Invoice.countDocuments({
    organizationId,
    invoiceNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function buildOrganizationSnapshot(organization: InvoiceOrganization) {
  return {
    name: organization.name ?? "",
    email: organization.defaultContact?.email ?? "",
    phoneNumber: organization.defaultContact?.phoneNumber ?? "",
    address: organization.address ?? "",
    logoUrl: organization.logoUrl ?? "",
    website: organization.website ?? "",
    primaryColor: organization.preferences?.primaryColor ?? "#f5b400",
  };
}

export async function buildInvoiceSnapshots(
  organization: InvoiceOrganization,
  body: Record<string, unknown>
) {
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
    organizationSnapshot: buildOrganizationSnapshot(organization),
  };
}

export function normalizeRecurring(body: Record<string, unknown>) {
  const recurring = (body.recurring ?? {}) as Record<string, unknown>;
  const frequency = String(recurring.frequency ?? "");
  return {
    enabled: Boolean(recurring.enabled),
    frequency: RECURRING_FREQUENCIES.has(frequency as InvoiceRecurringFrequency)
      ? (frequency as InvoiceRecurringFrequency)
      : null,
    startDate: parseInvoiceDate(recurring.startDate),
    endDate: parseInvoiceDate(recurring.endDate),
    nextRunDate: parseInvoiceDate(recurring.nextRunDate),
    autoSend: Boolean(recurring.autoSend),
  };
}

export function normalizePaymentMethod(value: unknown): InvoicePaymentMethod {
  const method = String(value ?? "bank_transfer");
  return PAYMENT_METHODS.has(method as InvoicePaymentMethod)
    ? (method as InvoicePaymentMethod)
    : "bank_transfer";
}

export function normalizeTemplate(value: unknown): InvoiceTemplateId {
  return normalizeInvoiceTemplateId(value);
}

/**
 * Picks the template to render for an invoice. A valid per-invoice template
 * wins; otherwise we fall back to the organization default, then the global
 * default. Legacy template names are mapped to a current design.
 */
export function resolveInvoiceTemplate(
  invoice: { template?: unknown } | null | undefined,
  organization?: { preferences?: { defaultInvoiceTemplate?: unknown } | null } | null
): InvoiceTemplateId {
  const perInvoice = String(invoice?.template ?? "").trim();
  if ((INVOICE_TEMPLATE_IDS as readonly string[]).includes(perInvoice)) {
    return perInvoice as InvoiceTemplateId;
  }

  const orgDefault = String(organization?.preferences?.defaultInvoiceTemplate ?? "").trim();
  if ((INVOICE_TEMPLATE_IDS as readonly string[]).includes(orgDefault)) {
    return orgDefault as InvoiceTemplateId;
  }

  return normalizeInvoiceTemplateId(perInvoice);
}

function normalizePayments(payments: unknown): IInvoicePayment[] {
  if (!Array.isArray(payments)) return [];
  return payments.map((payment) => {
    const source = (payment ?? {}) as Record<string, unknown>;
    return {
      amount: Math.max(0, toNumber(source.amount)),
      date: parseInvoiceDate(source.date) ?? new Date(),
      method: normalizePaymentMethod(source.method),
      reference: String(source.reference ?? "").trim(),
      notes: String(source.notes ?? "").trim(),
    };
  });
}

export async function createInvoiceRecord(
  organization: InvoiceOrganization,
  body: Record<string, unknown>
): Promise<IInvoice> {
  const lineItems = normalizeLineItems(body.lineItems);
  if (lineItems.length === 0) {
    throw new InvoiceServiceError("validation", "At least one invoice line item is required");
  }

  const snapshots = await buildInvoiceSnapshots(organization, body);
  const normalizedPayments = normalizePayments(body.payments);
  const totals = calculateTotals(lineItems, normalizedPayments);
  const status = resolveStatus(
    String(body.status ?? "draft") as InvoiceStatus,
    totals,
    parseInvoiceDate(body.dueDate)
  );

  return Invoice.create({
    organizationId: organization._id,
    invoiceNumber:
      String(body.invoiceNumber ?? "").trim() || (await nextInvoiceNumber(organization._id)),
    template: resolveInvoiceTemplate(
      { template: body.template },
      organization as { preferences?: { defaultInvoiceTemplate?: unknown } }
    ),
    status,
    issueDate: parseInvoiceDate(body.issueDate) ?? new Date(),
    dueDate: parseInvoiceDate(body.dueDate),
    paymentTerms: String(body.paymentTerms ?? organization.preferences?.defaultTerms ?? "").trim(),
    poNumber: String(body.poNumber ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    termsAndConditions: String(
      body.termsAndConditions ?? organization.preferences?.defaultTerms ?? ""
    ).trim(),
    upiId: String(body.upiId ?? "").trim().toLowerCase(),
    lineItems,
    payments: normalizedPayments,
    totals,
    recurring: normalizeRecurring(body),
    ...snapshots,
  });
}

export async function updateDraftInvoiceRecord(
  organization: InvoiceOrganization,
  invoiceId: string,
  body: Record<string, unknown>
): Promise<IInvoice> {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    throw new InvoiceServiceError("not_found", "Invoice not found");
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId: organization._id });
  if (!invoice) {
    throw new InvoiceServiceError("not_found", "Invoice not found");
  }
  if (invoice.status !== "draft") {
    throw new InvoiceServiceError("not_draft", "Only draft invoices can be edited");
  }

  const lineItems = "lineItems" in body ? normalizeLineItems(body.lineItems) : invoice.lineItems;
  if (lineItems.length === 0) {
    throw new InvoiceServiceError("validation", "At least one invoice line item is required");
  }

  // Partial-update safe: only rebuild the customer snapshot when customer input
  // is present, so chat-tool updates of unrelated fields don't wipe it.
  const hasCustomerInput = "customerId" in body || "customerSnapshot" in body;
  const snapshots = hasCustomerInput
    ? await buildInvoiceSnapshots(organization, body)
    : {
        customerId: invoice.customerId,
        customerSnapshot: invoice.customerSnapshot,
        organizationSnapshot: buildOrganizationSnapshot(organization),
      };

  invoice.set({
    invoiceNumber: String(body.invoiceNumber ?? invoice.invoiceNumber).trim(),
    template: normalizeTemplate(body.template ?? invoice.template),
    issueDate: parseInvoiceDate(body.issueDate) ?? invoice.issueDate,
    dueDate: "dueDate" in body ? parseInvoiceDate(body.dueDate) : invoice.dueDate,
    paymentTerms: String(body.paymentTerms ?? invoice.paymentTerms).trim(),
    poNumber: String(body.poNumber ?? invoice.poNumber).trim(),
    notes: String(body.notes ?? invoice.notes).trim(),
    termsAndConditions: String(body.termsAndConditions ?? invoice.termsAndConditions).trim(),
    upiId: String(body.upiId ?? invoice.upiId).trim().toLowerCase(),
    lineItems,
    totals: calculateTotals(lineItems, invoice.payments),
    recurring: "recurring" in body ? normalizeRecurring(body) : invoice.recurring,
    ...snapshots,
  });
  invoice.status = resolveStatus(invoice.status, invoice.totals, invoice.dueDate);

  await invoice.save();
  return invoice;
}

export type InvoiceSearchOptions = {
  organizationId: mongoose.Types.ObjectId;
  query?: string;
  status?: string;
  customerId?: string;
  outstandingOnly?: boolean;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  page?: number;
  limit?: number;
};

const OUTSTANDING_EXCLUDED_STATUSES: InvoiceStatus[] = ["draft", "cancelled", "written_off", "paid"];

export async function searchInvoiceRecords(options: InvoiceSearchOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const filter: Record<string, unknown> = { organizationId: options.organizationId };

  const status = String(options.status ?? "").trim();
  if (status && status !== "all") filter.status = status;

  const customerId = String(options.customerId ?? "").trim();
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    filter.customerId = new mongoose.Types.ObjectId(customerId);
  }

  if (options.outstandingOnly) {
    filter["totals.balanceDue"] = { $gt: 0 };
    if (!filter.status) filter.status = { $nin: OUTSTANDING_EXCLUDED_STATUSES };
  }

  const query = String(options.query ?? "").trim();
  if (query) {
    filter.$or = INVOICE_SEARCH_FIELDS.map((field) => ({
      [field]: { $regex: escapeRegex(query), $options: "i" },
    }));
  }

  if (options.dateFrom || options.dateTo) {
    const range: Record<string, Date> = {};
    if (options.dateFrom) range.$gte = options.dateFrom;
    if (options.dateTo) range.$lte = options.dateTo;
    filter.issueDate = range;
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issueDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
}
