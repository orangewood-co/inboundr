import type { IInvoice } from "../../models/invoice.model";
import type { PdfOrganizationBranding } from "../pdf-branding.service";

export type PdfInvoice = Pick<
  IInvoice,
  | "invoiceNumber"
  | "status"
  | "issueDate"
  | "dueDate"
  | "paymentTerms"
  | "poNumber"
  | "notes"
  | "termsAndConditions"
  | "template"
  | "customerSnapshot"
  | "organizationSnapshot"
  | "lineItems"
  | "totals"
>;

export type InvoiceTemplateAssets = {
  upiQr?: { buffer: Buffer; upiId: string } | null;
};

export type InvoiceTemplateProps = {
  invoice: PdfInvoice;
  branding: PdfOrganizationBranding;
  assets?: InvoiceTemplateAssets;
};
