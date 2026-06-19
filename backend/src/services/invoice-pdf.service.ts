import { createElement, type ReactElement } from "react";
import type { Response } from "express";
import { renderToBuffer, renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { resolveInvoiceUpiId } from "./invoice.service";
import { generateUpiQrPng } from "./pdf-image.service";
import { safePdfFilename, type PdfOrganizationBranding } from "./pdf-branding.service";
import { getInvoiceTemplate } from "./invoice-templates";
import type { InvoiceTemplateAssets, PdfInvoice } from "./invoice-templates/types";

export type InvoicePdfAssets = InvoiceTemplateAssets;

export async function buildInvoiceUpiAssets(
  invoice: {
    upiId?: string | null;
    invoiceNumber: string;
    totals: { balanceDue: number };
    organizationSnapshot?: { name?: string };
  },
  organization: { name?: string | null; preferences?: { defaultUpiId?: string } | null }
): Promise<InvoicePdfAssets | undefined> {
  const upiId = resolveInvoiceUpiId(invoice, organization);
  if (!upiId || invoice.totals.balanceDue <= 0) return undefined;

  const buffer = await generateUpiQrPng({
    upiId,
    payeeName: invoice.organizationSnapshot?.name || organization.name || undefined,
    amount: invoice.totals.balanceDue,
    note: `Invoice ${invoice.invoiceNumber}`,
  });
  return buffer ? { upiQr: { buffer, upiId } } : undefined;
}

function createInvoiceElement(
  invoice: PdfInvoice,
  branding: PdfOrganizationBranding,
  assets?: InvoicePdfAssets
): ReactElement<DocumentProps> {
  const template = getInvoiceTemplate(invoice.template);
  // Each template renders a <Document>; cast so the react-pdf renderers, which
  // are typed to accept a Document element specifically, accept it.
  return createElement(template.component, {
    invoice,
    branding,
    assets,
  }) as unknown as ReactElement<DocumentProps>;
}

export function renderInvoicePdfBuffer(
  invoice: PdfInvoice,
  branding: PdfOrganizationBranding,
  assets?: InvoicePdfAssets
): Promise<Buffer> {
  return renderToBuffer(createInvoiceElement(invoice, branding, assets));
}

export async function streamInvoicePdf(
  invoice: PdfInvoice,
  branding: PdfOrganizationBranding,
  res: Response,
  options: { inline?: boolean; assets?: InvoicePdfAssets } = {}
): Promise<void> {
  const stream = await renderToStream(createInvoiceElement(invoice, branding, options.assets));
  const disposition = options.inline ? "inline" : "attachment";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${safePdfFilename(invoice.invoiceNumber)}.pdf"`
  );

  stream.on("error", (err) => {
    console.error("Error streaming invoice PDF:", err);
    res.destroy(err);
  });
  stream.pipe(res);
}
