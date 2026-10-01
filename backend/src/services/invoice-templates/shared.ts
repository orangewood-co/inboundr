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

/** Amount prefixed with the rupee sign; every template font carries the ₹ glyph. */
export function money(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe < 0 ? "−" : ""}₹${amount(Math.abs(safe))}`;
}

export function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Status worth printing on a customer-facing document. Internal delivery
 * states ("sent", "viewed") are noise to the recipient, so they print nothing.
 */
export function documentStatus(status: string): { label: string; tone: "neutral" | "good" | "bad" } | null {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "neutral" };
    case "paid":
      return { label: "Paid", tone: "good" };
    case "partially_paid":
      return { label: "Partially paid", tone: "neutral" };
    case "overdue":
      return { label: "Overdue", tone: "bad" };
    case "cancelled":
      return { label: "Cancelled", tone: "bad" };
    case "written_off":
      return { label: "Written off", tone: "neutral" };
    default:
      return null;
  }
}

export function customerLines(invoice: PdfInvoice): string[] {
  const customer = invoice.customerSnapshot;
  const primary = customer.company || customer.name;
  return [
    customer.name && customer.name !== primary ? customer.name : "",
    customer.billingAddress,
    customer.email,
    customer.contactNumber,
  ]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}

/** Shipping address, only when it differs from the billing address. */
export function shippingAddress(invoice: PdfInvoice): string | null {
  const { shippingAddress: shipping, billingAddress } = invoice.customerSnapshot;
  const trimmed = (shipping ?? "").trim();
  if (!trimmed || trimmed === (billingAddress ?? "").trim()) return null;
  return trimmed;
}

export function lineItemMeta(item: PdfInvoice["lineItems"][number]): string {
  return [item.productCode, item.unit].map((part) => (part ?? "").trim()).filter(Boolean).join(" · ");
}

export function websiteLabel(website: string | null | undefined): string {
  return (website ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
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

export { pdfImageSource as imageSource } from "../pdf-branding.service";

export function orgContactLines(branding: PdfOrganizationBranding): string[] {
  return [branding.address, branding.email, branding.phoneNumber, websiteLabel(branding.website)]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}
