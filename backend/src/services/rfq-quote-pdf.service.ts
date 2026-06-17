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
type QuoteReply = Pick<IRFQReply, "subject" | "selectedProducts" | "generatedAt">;

function money(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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
  return product.price * product.quantity;
}

function lineTax(product: IRFQReplyProduct): number {
  const subtotal = lineSubtotal(product);
  if (subtotal == null || product.gstRate == null) return 0;
  return subtotal * (product.gstRate / 100);
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

function drawQuoteItems(doc: PDFKit.PDFDocument, products: IRFQReplyProduct[], startY: number): number {
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
    const subtotal = lineSubtotal(product);
    const description = product.description || product.code || product.queryName;
    const meta = [product.brand, product.code, product.hsnCode ? `HSN ${product.hsnCode}` : null]
      .filter(Boolean)
      .join(" · ");
    const pricingMeta = hasDiscount
      ? `Price ${money(baseUnitPrice(product))} · Discount ${discount}% · Net ${money(product.price)}`
      : null;

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
      .text(money(product.price), PDF_PAGE.margin + 320, y, { width: 70, align: "right" })
      .text(product.gstRate == null ? "-" : `${product.gstRate}%`, PDF_PAGE.margin + 400, y, { width: 40, align: "right" })
      .text(money(subtotal), PDF_PAGE.width - PDF_PAGE.margin - 82, y, { width: 82, align: "right" });

    y += hasDiscount ? 50 : 38;
  });

  return y + 8;
}

function drawTotals(doc: PDFKit.PDFDocument, products: IRFQReplyProduct[], startY: number): number {
  const subtotal = products.reduce((sum, product) => sum + (lineSubtotal(product) ?? 0), 0);
  const tax = products.reduce((sum, product) => sum + lineTax(product), 0);
  const total = subtotal + tax;
  const x = PDF_PAGE.width - PDF_PAGE.margin - 220;
  let y = ensurePdfRoom(doc, startY, 86);

  doc.roundedRect(x, y, 220, 78, 8).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.border);
  const rows: Array<[string, string]> = [
    ["Subtotal", money(subtotal)],
    ["Estimated GST", money(tax)],
    ["Total", money(total)],
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

  return y + 98;
}

export function createRFQQuotePdfDocument(options: {
  rfq: QuoteRFQ;
  reply: QuoteReply;
  organization: PdfOrganizationBranding;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
}): PDFKit.PDFDocument {
  const { rfq, reply, organization, paymentTerms, deliveryTerms } = options;
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

  y = drawQuoteItems(doc, reply.selectedProducts, y);
  y = drawTotals(doc, reply.selectedProducts, y);

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
}): Promise<Buffer> {
  return renderPdfBuffer(createRFQQuotePdfDocument(options));
}

export function rfqQuotePdfFilename(rfq: QuoteRFQ): string {
  return `${safePdfFilename(`quote-${rfq.quoteNumber || String(rfq._id)}`, "quote")}.pdf`;
}
