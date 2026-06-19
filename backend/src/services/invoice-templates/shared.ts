import type { PdfOrganizationBranding } from "../pdf-branding.service";
import { formatPdfDate, normalizePdfColor } from "../pdf-branding.service";
import type { PdfInvoice } from "./types";

export const formatDate = formatPdfDate;
export const normalizeColor = normalizePdfColor;

const numberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Grouped amount without a currency symbol, e.g. "1,23,456.00". */
export function amount(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

/**
 * Amount prefixed with the INR currency code. The bundled PDF fonts cannot
 * render the ₹ glyph, so the ASCII code keeps every template legible.
 */
export function money(value: number): string {
  return `INR ${amount(value)}`;
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Whether the invoice carries GST/HSN detail worth showing per line. Drives the
 * conditional tax columns across every template.
 */
export function invoiceHasTax(invoice: PdfInvoice): boolean {
  if (invoice.totals.taxTotal > 0) return true;
  return invoice.lineItems.some((item) => item.gstRate > 0 || Boolean(item.hsnCode));
}

export function invoiceHasDiscount(invoice: PdfInvoice): boolean {
  if (invoice.totals.discountTotal > 0) return true;
  return invoice.lineItems.some((item) => item.discountPercentage > 0);
}

/** Merge the resolved branding over the snapshot stored on the invoice. */
export function resolveBranding(
  invoice: PdfInvoice,
  branding: PdfOrganizationBranding
): PdfOrganizationBranding {
  const org = invoice.organizationSnapshot;
  return {
    name: branding.name ?? org.name,
    email: branding.email ?? org.email,
    phoneNumber: branding.phoneNumber ?? org.phoneNumber,
    address: branding.address ?? org.address,
    website: branding.website ?? org.website,
    primaryColor: branding.primaryColor ?? org.primaryColor,
    logoBuffer: branding.logoBuffer,
    letterheadBuffer: branding.letterheadBuffer,
  };
}

type ImageSource = { data: Buffer; format: "png" | "jpg" };

/** Sniff PNG vs JPEG so react-pdf can embed a raw image buffer. */
export function imageSource(buffer: Buffer | null | undefined): ImageSource | null {
  if (!buffer || buffer.length < 4) return null;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  return { data: buffer, format: isJpeg ? "jpg" : "png" };
}

export function orgContactLines(branding: PdfOrganizationBranding): string[] {
  return [branding.address, branding.email, branding.phoneNumber, branding.website]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}
