import type { IRFQ } from "../models/rfq.model";
import type { IRFQReply, IRFQReplyProduct } from "../models/rfq-reply.model";
import {
  createBrandedPdfDocument,
  drawPdfBrandHeader,
  drawPdfFooter,
  drawPdfKeyValueGrid,
  drawPdfSectionTitle,
  drawPdfTextBlock,
  ensurePdfRoom,
  formatPdfDate,
  PDF_COLORS,
  PDF_PAGE,
  safePdfFilename,
  type PdfOrganizationBranding,
} from "./pdf-branding.service";

type QuoteRFQ = Pick<IRFQ, "_id" | "customer" | "quoteNumber" | "createdAt">;
type QuoteReply = Pick<
  IRFQReply,
  "subject" | "selectedProducts" | "generatedAt" | "specialDiscountPercentage"
>;

function money(value: number | null | undefined, currency: string): string {
  if (value == null) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeDiscount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
}

function baseUnitPrice(product: IRFQReplyProduct): number | null {
  if (typeof product.basePrice === "number" && Number.isFinite(product.basePrice)) {
    return product.basePrice;
  }
  const discount = normalizeDiscount(product.discountPercent);
  if (product.price == null || discount <= 0 || discount >= 100) return product.price;
  return product.price / (1 - discount / 100);
}

function lineSubtotal(product: IRFQReplyProduct): number | null {
  if (product.price == null) return null;
  return product.price * product.quantity
    + (product.adjustments ?? []).reduce((sum, adjustment) => sum + (adjustment.amount ?? 0), 0);
}

function lineTax(product: IRFQReplyProduct, specialDiscountPercentage = 0): number {
  if (product.price == null) return 0;
  const base = product.price * product.quantity;
  const discountedBase = base * (1 - normalizeDiscount(specialDiscountPercentage) / 100);
  const taxableBase = discountedBase
    + (product.adjustments ?? [])
      .filter((adjustment) => adjustment.taxable)
      .reduce((sum, adjustment) => sum + (adjustment.amount ?? 0), 0);
  const taxRate = product.tax?.rate ?? product.gstRate;
  return taxRate == null ? 0 : taxableBase * (taxRate / 100);
}

function lineNetTotal(product: IRFQReplyProduct, specialDiscountPercentage = 0): number | null {
  if (product.price == null) return null;
  const base = product.price * product.quantity;
  const discountedBase = base * (1 - normalizeDiscount(specialDiscountPercentage) / 100);
  const adjustments = (product.adjustments ?? []).reduce(
    (sum, adjustment) => sum + (adjustment.amount ?? 0),
    0
  );
  return discountedBase + adjustments + lineTax(product, specialDiscountPercentage);
}

function renderPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function drawQuoteItems(
  doc: PDFKit.PDFDocument,
  products: IRFQReplyProduct[],
  startY: number,
  currency: string,
  specialDiscountPercentage: number
): number {
  let y = drawPdfSectionTitle(doc, "Quoted Items", startY);
  y = ensurePdfRoom(doc, y, 30);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(PDF_COLORS.muted)
    .text("Item", PDF_PAGE.margin, y, { width: 260 })
    .text("Qty", PDF_PAGE.margin + 270, y, { width: 40, align: "right" })
    .text("Net Rate", PDF_PAGE.margin + 320, y, { width: 70, align: "right" })
    .text("GST", PDF_PAGE.margin + 400, y, { width: 40, align: "right" })
    .text("Amount", PDF_PAGE.width - PDF_PAGE.margin - 82, y, { width: 82, align: "right" });
  y += 18;

  products.forEach((product, index) => {
    const discount = normalizeDiscount(product.discountPercent);
    const hasDiscount = discount > 0 && product.price != null;
    y = ensurePdfRoom(doc, y, hasDiscount ? 58 : 46);
    const subtotal = lineNetTotal(product, specialDiscountPercentage);
    const description = product.description || product.code || product.queryName;
    const taxCode = product.tax?.code ?? product.hsnCode;
    const taxRate = product.tax?.rate ?? product.gstRate;
    const adjustmentText = (product.adjustments ?? []).map(
      (adjustment) => `${adjustment.label} ${money(adjustment.amount ?? 0, currency)}`
    ).join(" · ");
    const meta = [product.brand, product.code, taxCode ? `${product.tax?.label ?? "Tax"} ${taxCode}` : null]
      .filter(Boolean)
      .join(" · ");
    const pricingMeta = hasDiscount
      ? `Price ${money(baseUnitPrice(product), currency)} · Discount ${discount}% · Net ${money(product.price, currency)}`
      : adjustmentText || null;

    doc
      .moveTo(PDF_PAGE.margin, y - 5)
      .lineTo(PDF_PAGE.width - PDF_PAGE.margin, y - 5)
      .strokeColor(PDF_COLORS.border)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(PDF_COLORS.text)
      .text(`${index + 1}. ${description}`, PDF_PAGE.margin, y, { width: 260, height: 12, ellipsis: true })
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PDF_COLORS.muted)
      .text(meta || product.queryName, PDF_PAGE.margin, y + 14, { width: 260, height: 12, ellipsis: true })
      .text(pricingMeta || "", PDF_PAGE.margin, y + 26, { width: 260, height: 12, ellipsis: true })
      .fillColor(PDF_COLORS.text)
      .fontSize(9)
      .text(String(product.quantity), PDF_PAGE.margin + 270, y, { width: 40, align: "right" })
      .text(money(product.price, currency), PDF_PAGE.margin + 320, y, { width: 70, align: "right" })
      .text(taxRate == null ? "-" : `${taxRate}%`, PDF_PAGE.margin + 400, y, { width: 40, align: "right" })
      .text(money(subtotal, currency), PDF_PAGE.width - PDF_PAGE.margin - 82, y, { width: 82, align: "right" });

    y += hasDiscount ? 50 : 38;
  });

  return y + 8;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  products: IRFQReplyProduct[],
  startY: number,
  currency: string,
  specialDiscountPercentage: number
): number {
  const subtotal = products.reduce((sum, product) => sum + (lineSubtotal(product) ?? 0), 0);
  const discount = normalizeDiscount(specialDiscountPercentage);
  const discountAmount = products.reduce(
    (sum, product) => sum + (product.price ?? 0) * product.quantity * discount / 100,
    0
  );
  const tax = products.reduce((sum, product) => sum + lineTax(product, discount), 0);
  const total = subtotal - discountAmount + tax;
  const x = PDF_PAGE.width - PDF_PAGE.margin - 220;
  let y = ensurePdfRoom(doc, startY, discount > 0 ? 106 : 86);

  const boxHeight = discount > 0 ? 98 : 78;
  doc.roundedRect(x, y, 220, boxHeight, 8).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.border);
  const rows: Array<[string, string]> = [
    ["Subtotal", money(subtotal, currency)],
    ...(discount > 0 ? [[`Discount (${discount}%)`, `-${money(discountAmount, currency)}`] as [string, string]] : []),
    ["Estimated tax", money(tax, currency)],
    ["Total", money(total, currency)],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + 12 + index * 20;
    doc
      .font(index === 2 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(index === 2 ? 11 : 9)
      .fillColor(index === 2 ? PDF_COLORS.text : PDF_COLORS.muted)
      .text(label, x + 14, rowY, { width: 96 })
      .text(value, x + 110, rowY, { width: 96, align: "right" });
  });

  return y + boxHeight + 20;
}

export function createRFQQuotePdfDocument(options: {
  rfq: QuoteRFQ;
  reply: QuoteReply;
  organization: PdfOrganizationBranding;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  currency?: string;
}): PDFKit.PDFDocument {
  const { rfq, reply, organization, paymentTerms, deliveryTerms, currency = "INR" } = options;
  const quoteNumber = rfq.quoteNumber || String(rfq._id);
  const doc = createBrandedPdfDocument({
    title: `Quote ${quoteNumber}`,
    author: organization.name,
    subject: "RFQ Quote",
    keywords: "quote, rfq, pdf",
  });

  let y = drawPdfBrandHeader(doc, {
    title: "Quote",
    subtitle: reply.subject,
    organization,
  });

  y = drawPdfKeyValueGrid(doc, y, [
    ["Quote #", quoteNumber],
    ["Quote Date", formatPdfDate(reply.generatedAt ?? new Date())],
    ["Customer", rfq.customer?.company || rfq.customer?.name],
    ["Contact", rfq.customer?.name],
    ["Email", rfq.customer?.email],
    ["Phone", rfq.customer?.contactNumber],
  ], 3);

  if (rfq.customer?.address) {
    y = drawPdfSectionTitle(doc, "Billing Address", y);
    y = drawPdfTextBlock(doc, rfq.customer.address, y, { color: PDF_COLORS.muted });
  }

  y = drawQuoteItems(
    doc,
    reply.selectedProducts,
    y,
    currency,
    reply.specialDiscountPercentage ?? 0
  );
  y = drawTotals(
    doc,
    reply.selectedProducts,
    y,
    currency,
    reply.specialDiscountPercentage ?? 0
  );

  if (paymentTerms) {
    y = drawPdfSectionTitle(doc, "Payment Terms", y);
    y = drawPdfTextBlock(doc, paymentTerms, y, { color: PDF_COLORS.muted });
  }

  if (deliveryTerms) {
    y = drawPdfSectionTitle(doc, "Delivery Terms", y);
    y = drawPdfTextBlock(doc, deliveryTerms, y, { color: PDF_COLORS.muted });
  }

  drawPdfFooter(doc, `Quote ${quoteNumber}`);
  return doc;
}

export function renderRFQQuotePdfBuffer(options: {
  rfq: QuoteRFQ;
  reply: QuoteReply;
  organization: PdfOrganizationBranding;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  currency?: string;
}): Promise<Buffer> {
  return renderPdfBuffer(createRFQQuotePdfDocument(options));
}

export function rfqQuotePdfFilename(rfq: QuoteRFQ): string {
  return `${safePdfFilename(`quote-${rfq.quoteNumber || String(rfq._id)}`, "quote")}.pdf`;
}
