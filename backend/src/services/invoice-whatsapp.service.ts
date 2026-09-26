import mongoose from "mongoose";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

import type { IInvoice } from "../models/invoice.model";
import type { IOrganization } from "../models/organization.model";
import type { IWhatsAppAccount } from "../models/whatsapp-account.model";
import { buildInvoiceUpiAssets, renderInvoicePdfBuffer } from "./invoice-pdf.service";
import { resolveOrganizationPdfBranding } from "./organization-pdf-branding.service";
import type { PdfOrganizationBranding } from "./pdf-branding.service";
import { createPresignedViewUrl, createUploadKey, putObjectBuffer } from "./storage.service";
import { findWhatsAppAccountForOrganization } from "./whatsapp-support.service";
import {
  WHATSAPP_TEMPLATE_LANGUAGE,
  WHATSAPP_TEMPLATE_NAMES,
  isTemplateApproved,
  type WhatsAppTemplateKey,
} from "./whatsapp-template.service";
import { WhatsAppApiError, sendWhatsAppTemplate } from "./whatsapp.service";

/** The product is India-first; bare 10-digit numbers are assumed to be Indian. */
const DEFAULT_COUNTRY: CountryCode = "IN";

export class InvoiceWhatsAppError extends Error {
  code:
    | "not_connected"
    | "template_not_approved"
    | "no_recipient"
    | "invalid_recipient"
    | "send_failed";

  constructor(code: InvoiceWhatsAppError["code"], message: string) {
    super(message);
    this.name = "InvoiceWhatsAppError";
    this.code = code;
  }
}

/**
 * Normalizes a free-text contact number into +E.164. Accepts "+91 98765 43210",
 * "09876543210", "9876543210" and similar. Returns null when it cannot be a
 * valid mobile number.
 */
export function normalizeWhatsAppRecipient(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function invoiceWhatsAppRecipient(invoice: Pick<IInvoice, "customerSnapshot">): string | null {
  return normalizeWhatsAppRecipient(invoice.customerSnapshot?.contactNumber);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "on receipt";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

/** Template body parameters cannot contain newlines, tabs, or 4+ spaces. */
function templateText(value: string, max = 200): string {
  const clean = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return (clean || "-").slice(0, max);
}

function customerGreetingName(invoice: IInvoice): string {
  return invoice.customerSnapshot.name || invoice.customerSnapshot.company || "there";
}

/**
 * Renders the PDF and stores it so Meta can fetch it by link. Reusing the same
 * S3 prefix per invoice keeps storage tidy without needing cleanup jobs.
 */
async function uploadInvoicePdf(
  invoice: IInvoice,
  organization: IOrganization,
  branding?: PdfOrganizationBranding
): Promise<{ url: string; filename: string }> {
  const resolvedBranding = branding ?? (await resolveOrganizationPdfBranding(organization));
  const assets = await buildInvoiceUpiAssets(invoice, organization);
  const pdf = await renderInvoicePdfBuffer(invoice, resolvedBranding, assets);
  const filename = `${invoice.invoiceNumber}.pdf`;
  const key = createUploadKey({
    scope: "invoices",
    organizationId: String(invoice.organizationId),
    fileName: filename,
    contentType: "application/pdf",
    size: pdf.byteLength,
    prefixParts: [String(invoice._id), "whatsapp"],
  });
  await putObjectBuffer({ key, body: pdf, contentType: "application/pdf" });
  const { url } = await createPresignedViewUrl(key);
  return { url, filename };
}

async function requireAccount(
  organizationId: mongoose.Types.ObjectId,
  templateKey: WhatsAppTemplateKey
): Promise<IWhatsAppAccount> {
  const account = await findWhatsAppAccountForOrganization(organizationId);
  if (!account || !account.enabled || account.status === "disabled") {
    throw new InvoiceWhatsAppError(
      "not_connected",
      "WhatsApp is not connected for this organization. Connect it in Settings → Support → WhatsApp."
    );
  }
  if (!isTemplateApproved(account, templateKey)) {
    throw new InvoiceWhatsAppError(
      "template_not_approved",
      `The "${WHATSAPP_TEMPLATE_NAMES[templateKey]}" WhatsApp template is not approved yet. Sync templates in Settings → Support → WhatsApp and wait for Meta's approval.`
    );
  }
  return account;
}

export interface InvoiceWhatsAppSendResult {
  messageId: string;
  to: string;
}

async function sendTemplate(
  account: IWhatsAppAccount,
  to: string,
  templateKey: WhatsAppTemplateKey,
  document: { url: string; filename: string },
  bodyParameters: string[]
): Promise<InvoiceWhatsAppSendResult> {
  try {
    const result = await sendWhatsAppTemplate(account, to, {
      name: WHATSAPP_TEMPLATE_NAMES[templateKey],
      language: WHATSAPP_TEMPLATE_LANGUAGE,
      components: [
        {
          type: "header",
          parameters: [{ type: "document", document: { link: document.url, filename: document.filename } }],
        },
        {
          type: "body",
          parameters: bodyParameters.map((text) => ({ type: "text" as const, text: templateText(text) })),
        },
      ],
    });
    return { messageId: result.messageId, to };
  } catch (err) {
    const message = err instanceof WhatsAppApiError ? err.agentMessage : (err as Error)?.message || "Send failed";
    throw new InvoiceWhatsAppError("send_failed", message);
  }
}

/**
 * Sends the invoice itself (template `inboundr_invoice`) with the PDF attached.
 * Throws `InvoiceWhatsAppError` with a user-facing message on any failure.
 */
export async function sendInvoiceOnWhatsApp(
  invoice: IInvoice,
  organization: IOrganization,
  options: { account?: IWhatsAppAccount; branding?: PdfOrganizationBranding } = {}
): Promise<InvoiceWhatsAppSendResult> {
  const account = options.account ?? (await requireAccount(invoice.organizationId, "invoice"));
  if (!invoice.customerSnapshot.contactNumber) {
    throw new InvoiceWhatsAppError("no_recipient", "The customer on this invoice has no contact number.");
  }
  const to = invoiceWhatsAppRecipient(invoice);
  if (!to) {
    throw new InvoiceWhatsAppError(
      "invalid_recipient",
      `"${invoice.customerSnapshot.contactNumber}" is not a valid mobile number for WhatsApp.`
    );
  }

  const document = await uploadInvoicePdf(invoice, organization, options.branding);
  return sendTemplate(account, to, "invoice", document, [
    customerGreetingName(invoice),
    invoice.invoiceNumber,
    invoice.organizationSnapshot.name || organization.name,
    formatMoney(invoice.totals.balanceDue),
    formatDate(invoice.dueDate),
  ]);
}

/**
 * Sends a payment reminder (template `inboundr_payment_reminder`) with the PDF
 * attached. `daysPastDue` drives the "due today / N days past due" phrase.
 */
export async function sendInvoiceReminderOnWhatsApp(
  invoice: IInvoice,
  organization: IOrganization,
  daysPastDue: number,
  options: { account?: IWhatsAppAccount; branding?: PdfOrganizationBranding } = {}
): Promise<InvoiceWhatsAppSendResult> {
  const account = options.account ?? (await requireAccount(invoice.organizationId, "paymentReminder"));
  const to = invoiceWhatsAppRecipient(invoice);
  if (!to) {
    throw new InvoiceWhatsAppError(
      invoice.customerSnapshot.contactNumber ? "invalid_recipient" : "no_recipient",
      "The customer on this invoice has no valid mobile number for WhatsApp."
    );
  }

  const dueLabel =
    daysPastDue > 0 ? `${daysPastDue} day${daysPastDue === 1 ? "" : "s"} past its due date` : "due today";
  const document = await uploadInvoicePdf(invoice, organization, options.branding);
  return sendTemplate(account, to, "paymentReminder", document, [
    customerGreetingName(invoice),
    invoice.invoiceNumber,
    invoice.organizationSnapshot.name || organization.name,
    dueLabel,
    formatMoney(invoice.totals.balanceDue),
    formatDate(invoice.dueDate),
  ]);
}

/**
 * Resolves the account for a batch of reminder sends, or null (with a reason)
 * when WhatsApp cannot be used for this organization right now.
 */
export async function resolveReminderWhatsAppAccount(
  organizationId: mongoose.Types.ObjectId
): Promise<{ account: IWhatsAppAccount } | { account: null; reason: string }> {
  try {
    return { account: await requireAccount(organizationId, "paymentReminder") };
  } catch (err) {
    return { account: null, reason: (err as Error).message };
  }
}
