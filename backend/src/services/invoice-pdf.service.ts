import type { Response } from "express";
import type { IInvoice, IInvoiceLineItem } from "../models/invoice.model";
import {
  createBrandedPdfDocument,
  drawPdfBrandHeader,
  drawPdfFooter,
  drawPdfKeyValueGrid,
  drawPdfSectionTitle,
  ensurePdfRoom,
  formatPdfDate as date,
  normalizePdfColor,
  PDF_COLORS as COLORS,
  PDF_PAGE as PAGE,
  safePdfFilename,
  streamPdfDocument,
  type PdfOrganizationBranding,
} from "./pdf-branding.service";

type PdfInvoice = Pick<
  IInvoice,
  | "invoiceNumber"
  | "status"
  | "issueDate"
  | "dueDate"
  | "paymentTerms"
  | "poNumber"
  | "notes"
  | "termsAndConditions"
  | "customerSnapshot"
  | "organizationSnapshot"
  | "lineItems"
  | "totals"
>;

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeBranding(invoice: PdfInvoice, branding: PdfOrganizationBranding): PdfOrganizationBranding {
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

function fitText(doc: PDFKit.PDFDocument, value: string | number, x: number, y: number, options: PDFKit.Mixins.TextOptions) {
  doc.text(String(value || "-"), x, y, { ellipsis: true, ...options });
}

function drawSummary(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number, primary: string): number {
  const y = ensurePdfRoom(doc, startY, 102);
  const cardGap = 10;
  const cardWidth = (PAGE.width - PAGE.margin * 2 - cardGap * 2) / 3;
  const cards = [
    {
      label: "Balance Due",
      value: money(invoice.totals.balanceDue),
      sublabel: invoice.dueDate ? `Due ${date(invoice.dueDate)}` : "No due date",
      highlight: true,
    },
    {
      label: "Invoice",
      value: invoice.invoiceNumber,
      sublabel: statusLabel(invoice.status),
    },
    {
      label: "Issued",
      value: date(invoice.issueDate),
      sublabel: invoice.paymentTerms || "Payment terms not set",
    },
  ];

  cards.forEach((card, index) => {
    const x = PAGE.margin + index * (cardWidth + cardGap);
    doc
      .roundedRect(x, y, cardWidth, 78, 10)
      .fillAndStroke(card.highlight ? primary : COLORS.soft, card.highlight ? primary : COLORS.border);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(card.highlight ? COLORS.white : COLORS.muted)
      .text(card.label.toUpperCase(), x + 14, y + 14, { width: cardWidth - 28 });
    doc
      .font("Helvetica-Bold")
      .fontSize(card.highlight ? 16 : 12)
      .fillColor(card.highlight ? COLORS.white : COLORS.text)
      .text(card.value, x + 14, y + 31, { width: cardWidth - 28, height: 18, ellipsis: true });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(card.highlight ? COLORS.white : COLORS.muted)
      .text(card.sublabel, x + 14, y + 54, { width: cardWidth - 28, height: 12, ellipsis: true });
  });

  return y + 98;
}

function drawInvoiceMeta(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): number {
  return drawPdfKeyValueGrid(
    doc,
    startY,
    [
      ["Invoice #", invoice.invoiceNumber],
      ["Status", statusLabel(invoice.status)],
      ["Issue Date", date(invoice.issueDate)],
      ["Due Date", date(invoice.dueDate)],
      ["Payment Terms", invoice.paymentTerms || "-"],
      ["PO / Reference", invoice.poNumber || "-"],
    ],
    3
  );
}

function drawPartyBlocks(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): number {
  const y = ensurePdfRoom(doc, startY, 128);
  const blockWidth = (PAGE.width - PAGE.margin * 2 - 16) / 2;
  const customer = invoice.customerSnapshot;
  const blocks = [
    {
      title: "Bill To",
      name: customer.company || customer.name || "-",
      lines: [
        customer.company && customer.name && customer.company !== customer.name ? customer.name : null,
        customer.billingAddress,
        customer.email,
        customer.contactNumber,
      ],
    },
    {
      title: "Ship To",
      name: customer.company || customer.name || "-",
      lines: [customer.shippingAddress || customer.billingAddress],
    },
  ];

  blocks.forEach((block, index) => {
    const x = PAGE.margin + index * (blockWidth + 16);
    doc.roundedRect(x, y, blockWidth, 112, 10).fillAndStroke("#ffffff", COLORS.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text(block.title.toUpperCase(), x + 14, y + 14, {
      width: blockWidth - 28,
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text).text(block.name, x + 14, y + 32, {
      width: blockWidth - 28,
      height: 16,
      ellipsis: true,
    });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(block.lines.filter(Boolean).join("\n") || "-", x + 14, y + 54, {
        width: blockWidth - 28,
        height: 46,
        lineGap: 2,
        ellipsis: true,
      });
  });

  return y + 132;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, primary: string): number {
  const columns = [
    ["Item", PAGE.margin + 12, 158, "left"],
    ["HSN", PAGE.margin + 178, 42, "left"],
    ["Qty", PAGE.margin + 224, 28, "right"],
    ["Rate", PAGE.margin + 258, 54, "right"],
    ["Disc", PAGE.margin + 318, 34, "right"],
    ["GST", PAGE.margin + 358, 34, "right"],
    ["Total", PAGE.margin + 398, 88, "right"],
  ] as const;

  doc
    .roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 26, 8)
    .fill(primary);

  columns.forEach(([label, x, width, align]) => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.white).text(label, x, y + 9, {
      width,
      align,
    });
  });

  return y + 26;
}

function drawLineItem(doc: PDFKit.PDFDocument, item: IInvoiceLineItem, y: number, index: number): number {
  const descriptionHeight = doc.heightOfString(item.description || "-", {
    width: 158,
    lineGap: 1,
  });
  const meta = [item.productCode, item.hsnCode ? `HSN ${item.hsnCode}` : null, item.unit].filter(Boolean).join(" · ");
  const rowHeight = Math.max(38, descriptionHeight + (meta ? 24 : 18));

  doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, rowHeight).fillAndStroke(index % 2 === 0 ? "#ffffff" : COLORS.soft, COLORS.border);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.text);
  fitText(doc, item.description, PAGE.margin + 12, y + 8, { width: 158, height: rowHeight - 16, lineGap: 1 });

  if (meta) {
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(meta, PAGE.margin + 12, y + rowHeight - 15, {
      width: 158,
      height: 10,
      ellipsis: true,
    });
  }

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.text);
  fitText(doc, item.hsnCode, PAGE.margin + 178, y + 9, { width: 42 });
  fitText(doc, item.quantity, PAGE.margin + 224, y + 9, { width: 28, align: "right" });
  fitText(doc, money(item.unitPrice), PAGE.margin + 258, y + 9, { width: 54, align: "right" });
  fitText(doc, `${item.discountPercentage}%`, PAGE.margin + 318, y + 9, { width: 34, align: "right" });
  fitText(doc, `${item.gstRate}%`, PAGE.margin + 358, y + 9, { width: 34, align: "right" });
  fitText(doc, money(item.totalAmount), PAGE.margin + 398, y + 9, { width: 88, align: "right" });

  return y + rowHeight;
}

function drawLineItems(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number, primary: string): number {
  let y = drawPdfSectionTitle(doc, "Line Items", startY);
  y = drawTableHeader(doc, y, primary);

  invoice.lineItems.forEach((item, index) => {
    const descriptionHeight = doc.heightOfString(item.description || "-", {
      width: 158,
      lineGap: 1,
    });
    const rowHeight = Math.max(38, descriptionHeight + 24);
    y = ensurePdfRoom(doc, y, rowHeight + 110);
    if (y === PAGE.margin) y = drawTableHeader(doc, y, primary);
    y = drawLineItem(doc, item, y, index);
  });

  return y + 16;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number, primary: string): number {
  let y = ensurePdfRoom(doc, startY, 178);
  const x = PAGE.width - PAGE.margin - 220;
  const boxHeight = 154;
  const rows = [
    ["Subtotal", invoice.totals.subtotal],
    ["Discount", invoice.totals.discountTotal],
    ["Taxable Total", invoice.totals.taxableTotal],
    ["GST Total", invoice.totals.taxTotal],
    ["Grand Total", invoice.totals.grandTotal],
    ["Paid", invoice.totals.paidTotal],
    ["Balance Due", invoice.totals.balanceDue],
  ];

  doc.roundedRect(x, y, 220, boxHeight, 10).fillAndStroke("#ffffff", COLORS.border);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text("Totals", x + 14, y + 14, { width: 192 });

  let rowY = y + 34;
  rows.forEach(([label, value]) => {
    const isBalance = label === "Balance Due";
    const isEmphasis = label === "Grand Total" || isBalance;
    if (isEmphasis) {
      doc.moveTo(x + 14, rowY - 5).lineTo(x + 206, rowY - 5).stroke(COLORS.border);
    }
    doc
      .font(isEmphasis ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isBalance ? 11 : 9)
      .fillColor(isBalance ? primary : COLORS.text)
      .text(String(label), x + 14, rowY, { width: 92 })
      .text(money(Number(value)), x + 106, rowY, { width: 100, align: "right" });
    rowY += isBalance ? 20 : 15;
  });

  return y + boxHeight + 18;
}

function drawNotes(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): void {
  let y = ensurePdfRoom(doc, startY, 96);
  const sections: Array<[string, string]> = [
    ["Notes", invoice.notes],
    ["Terms & Conditions", invoice.termsAndConditions],
  ];

  sections.forEach(([title, content]) => {
    if (!content) return;
    const height = doc.heightOfString(content, { width: PAGE.width - PAGE.margin * 2 - 28, lineGap: 2 }) + 42;
    y = ensurePdfRoom(doc, y, height);
    doc.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, height, 10).fillAndStroke("#ffffff", COLORS.border);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text(title, PAGE.margin + 14, y + 12);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(content, PAGE.margin + 14, y + 29, { width: PAGE.width - PAGE.margin * 2 - 28, lineGap: 2 });
    y += height + 10;
  });
}

export function createInvoicePdfDocument(invoice: PdfInvoice, branding: PdfOrganizationBranding): PDFKit.PDFDocument {
  const organization = mergeBranding(invoice, branding);
  const primary = normalizePdfColor(organization.primaryColor);
  const doc = createBrandedPdfDocument({
    title: `Invoice ${invoice.invoiceNumber}`,
    author: organization.name,
    subject: "Invoice",
    keywords: "invoice, pdf",
  });

  let y = drawPdfBrandHeader(doc, {
    title: "Invoice",
    subtitle: `Invoice ${invoice.invoiceNumber}`,
    organization,
  });
  y = drawSummary(doc, invoice, y, primary);
  y = drawInvoiceMeta(doc, invoice, y);
  y = drawPartyBlocks(doc, invoice, y);
  y = drawLineItems(doc, invoice, y, primary);
  y = drawTotals(doc, invoice, y, primary);
  drawNotes(doc, invoice, y);
  drawPdfFooter(doc, invoice.invoiceNumber);

  return doc;
}

export function streamInvoicePdf(
  invoice: PdfInvoice,
  branding: PdfOrganizationBranding,
  res: Response,
  options: { inline?: boolean } = {}
): void {
  const doc = createInvoicePdfDocument(invoice, branding);
  streamPdfDocument(doc, safePdfFilename(invoice.invoiceNumber), res, {
    disposition: options.inline ? "inline" : "attachment",
  });
}

export function renderInvoicePdfBuffer(invoice: PdfInvoice, branding: PdfOrganizationBranding): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createInvoicePdfDocument(invoice, branding);
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
