import { tool } from "ai";
import mongoose from "mongoose";
import { z } from "zod";

import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { Customer } from "../models/customer.model";
import { Invoice, type IInvoiceLineItem, type IInvoiceTotals } from "../models/invoice.model";
import { getEmployeeAccessState } from "../services/employee-access.service";
import { hasEffectiveFeature } from "../services/entitlement.service";
import {
  InvoiceServiceError,
  createInvoiceRecord,
  searchInvoiceRecords,
  updateDraftInvoiceRecord,
} from "../services/invoice.service";

type InvoiceToolContext = {
  user: AuthenticatedRequest["user"];
  organization: OrganizationRequest["organization"];
  organizationMembership: OrganizationRequest["organizationMembership"];
};

const lineItemSchema = z.object({
  description: z.string().min(1).describe("Human-readable description of the line item."),
  quantity: z.number().positive().describe("Quantity of units billed."),
  unitPrice: z.number().min(0).describe("Price per unit in INR, before tax and discount."),
  gstRate: z
    .number()
    .min(0)
    .optional()
    .describe("GST percentage for this line, e.g. 18. Use the product's gstRate from searchProducts when available."),
  discountPercentage: z.number().min(0).max(100).optional().describe("Discount percentage applied to this line."),
  hsnCode: z.string().optional().describe("HSN code, from searchProducts when available."),
  productCode: z.string().optional().describe("Product code or SKU, from searchProducts when available."),
  unit: z.string().optional().describe("Unit of measure, e.g. Nos, Kg."),
  productId: z
    .number()
    .optional()
    .describe("Catalog product id from searchProducts. Omit for free-form items."),
});

const customerSnapshotSchema = z.object({
  name: z.string().optional().describe("Customer contact name."),
  company: z.string().optional().describe("Customer company name."),
  email: z.string().optional().describe("Customer email address."),
  contactNumber: z.string().optional().describe("Customer phone number."),
  billingAddress: z.string().optional().describe("Billing address."),
  shippingAddress: z.string().optional().describe("Shipping address."),
});

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "written_off",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureInvoiceAccess(context: InvoiceToolContext): Promise<void> {
  if (context.organization.status === "suspended") {
    throw new Error("This organization is suspended.");
  }

  if (!hasEffectiveFeature(context.organization, "invoices")) {
    throw new Error("The invoices feature is not enabled for this organization.");
  }

  const access = await getEmployeeAccessState({
    organizationId: context.organization._id,
    organizationMemberId: context.organizationMembership?._id ?? null,
    role: context.organizationMembership.role,
  });

  if (!access.enabled) {
    throw new Error("Employee platform access is disabled for this organization.");
  }

  if (access.restricted && !access.allowedModules.includes("invoices")) {
    throw new Error("You do not have access to the invoices module.");
  }
}

function serializeInvoice(invoice: {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  poNumber?: string;
  notes?: string;
  customerSnapshot: { name: string; company: string; email: string };
  lineItems: IInvoiceLineItem[];
  totals: IInvoiceTotals;
}) {
  return {
    id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : null,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
    poNumber: invoice.poNumber ?? "",
    customerName: invoice.customerSnapshot.name || invoice.customerSnapshot.company || "",
    customerCompany: invoice.customerSnapshot.company || "",
    customerEmail: invoice.customerSnapshot.email || "",
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate,
      discountPercentage: item.discountPercentage,
      totalAmount: item.totalAmount,
    })),
    totals: {
      subtotal: invoice.totals.subtotal,
      discountTotal: invoice.totals.discountTotal,
      taxTotal: invoice.totals.taxTotal,
      grandTotal: invoice.totals.grandTotal,
      paidTotal: invoice.totals.paidTotal,
      balanceDue: invoice.totals.balanceDue,
    },
  };
}

function serviceErrorResult(error: InvoiceServiceError) {
  const status =
    error.code === "not_found" ? "not_found" : error.code === "not_draft" ? "not_draft" : "invalid";
  return { status, error: error.message };
}

export function createInvoiceTools(context: InvoiceToolContext) {
  return {
    searchCustomers: tool({
      description:
        "Search the organization's customers by name, company, or email. Use this to resolve a customer before creating an invoice. If multiple customers match, ask the user which one they mean.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Customer name, company, or email to search for."),
        limit: z.number().int().min(1).max(10).optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        await ensureInvoiceAccess(context);

        const regex = { $regex: escapeRegex(query.trim()), $options: "i" };
        const customers = await Customer.find({
          organizationId: context.organization._id,
          $or: [{ name: regex }, { company: regex }, { email: regex }],
        })
          .limit(limit)
          .lean();

        return {
          query,
          matches: customers.map((customer) => ({
            id: customer._id.toString(),
            name: customer.name,
            company: customer.company,
            email: customer.email,
            contactNumber: customer.contactNumber,
            address: customer.address,
          })),
        };
      },
    }),
    createInvoice: tool({
      description:
        "Create a new draft invoice. Resolve the customer with searchCustomers first (pass customerId), or provide customerSnapshot fields for a one-off customer. Use searchProducts to get unitPrice, gstRate, hsnCode, and productId for catalog products. The invoice is always created as a draft; the invoice number is generated automatically.",
      inputSchema: z.object({
        customerId: z
          .string()
          .optional()
          .describe("Customer id from searchCustomers. Preferred over manual snapshot fields."),
        customerSnapshot: customerSnapshotSchema
          .optional()
          .describe("Manual customer details when there is no matching customer record."),
        lineItems: z.array(lineItemSchema).min(1).describe("Invoice line items."),
        issueDate: z.string().optional().describe("Issue date in ISO format. Defaults to today."),
        dueDate: z.string().optional().describe("Due date in ISO format."),
        paymentTerms: z.string().optional().describe("Payment terms text, e.g. 'Net 30'."),
        poNumber: z.string().optional().describe("Customer purchase order number."),
        notes: z.string().optional().describe("Notes shown on the invoice."),
      }),
      execute: async (input) => {
        await ensureInvoiceAccess(context);

        try {
          const invoice = await createInvoiceRecord(context.organization, {
            customerId: input.customerId,
            customerSnapshot: input.customerSnapshot,
            lineItems: input.lineItems,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            paymentTerms: input.paymentTerms,
            poNumber: input.poNumber,
            notes: input.notes,
          });

          return { status: "created", invoice: serializeInvoice(invoice) };
        } catch (err) {
          if (err instanceof InvoiceServiceError) return serviceErrorResult(err);
          throw err;
        }
      },
    }),
    searchInvoices: tool({
      description:
        "Search the organization's invoices by customer name, company, email, invoice number, or PO number, optionally filtered by status and issue-date range.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Text matched against invoice number, customer name/company/email, and PO number."),
        status: z
          .enum(INVOICE_STATUSES)
          .optional()
          .describe("Filter by invoice status."),
        dateFrom: z.string().optional().describe("Earliest issue date in ISO format."),
        dateTo: z.string().optional().describe("Latest issue date in ISO format."),
        limit: z.number().int().min(1).max(20).optional().default(10),
      }),
      execute: async ({ query, status, dateFrom, dateTo, limit }) => {
        await ensureInvoiceAccess(context);

        const result = await searchInvoiceRecords({
          organizationId: context.organization._id,
          query,
          status,
          dateFrom: dateFrom ? new Date(dateFrom) : null,
          dateTo: dateTo ? new Date(dateTo) : null,
          limit,
        });

        return {
          total: result.total,
          invoices: result.invoices.map((invoice) => serializeInvoice(invoice)),
        };
      },
    }),
    updateInvoice: tool({
      description:
        "Update a draft invoice. Only draft invoices can be edited. Provide only the fields to change; line items replace the existing list entirely, so include all items the invoice should have.",
      inputSchema: z.object({
        invoiceId: z.string().min(1).describe("The id of the invoice to update."),
        lineItems: z
          .array(lineItemSchema)
          .min(1)
          .optional()
          .describe("Full replacement list of line items."),
        customerId: z.string().optional().describe("New customer id from searchCustomers."),
        customerSnapshot: customerSnapshotSchema.optional(),
        issueDate: z.string().optional().describe("Issue date in ISO format."),
        dueDate: z.string().nullable().optional().describe("Due date in ISO format, or null to clear it."),
        paymentTerms: z.string().optional(),
        poNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ invoiceId, ...changes }) => {
        await ensureInvoiceAccess(context);

        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(changes)) {
          if (value !== undefined) body[key] = value;
        }
        if ("dueDate" in changes && changes.dueDate === null) body.dueDate = null;

        try {
          const invoice = await updateDraftInvoiceRecord(context.organization, invoiceId, body);
          return { status: "updated", invoice: serializeInvoice(invoice) };
        } catch (err) {
          if (err instanceof InvoiceServiceError) return serviceErrorResult(err);
          throw err;
        }
      },
    }),
    sendInvoice: tool({
      description:
        "Request sending an invoice to the customer. Sending is not available from chat; this tool confirms the invoice exists and tells the user to send it from the Invoices page.",
      inputSchema: z.object({
        invoiceId: z.string().min(1).describe("The id of the invoice the user wants to send."),
      }),
      execute: async ({ invoiceId }) => {
        await ensureInvoiceAccess(context);

        if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
          return { status: "not_found", error: "Invoice not found" };
        }

        const invoice = await Invoice.findOne({
          _id: invoiceId,
          organizationId: context.organization._id,
        }).lean();
        if (!invoice) {
          return { status: "not_found", error: "Invoice not found" };
        }

        return {
          status: "manual_send_required",
          invoiceNumber: invoice.invoiceNumber,
          message:
            "Invoices cannot be sent from chat. Please open the invoice on the Invoices page and use the Send action there.",
        };
      },
    }),
  };
}
