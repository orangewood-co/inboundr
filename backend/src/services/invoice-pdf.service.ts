import type { Response } from "express";
import type { IInvoice, IInvoiceLineItem } from "../models/invoice.model";
import {
  createBrandedPdfDocument,
  drawPdfFooter,
  ensurePdfRoom,
  formatPdfDate as date,
  PDF_COLORS as COLORS,
  PDF_PAGE as PAGE,
  safePdfFilename,
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

function fitText(doc: PDFKit.PDFDocument, value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions) {
  doc.text(value || "-", x, y, { ellipsis: true, ...options });
}

function drawHeader(doc: PDFKit.PDFDocument, invoice: PdfInvoice): number {
  const org = invoice.organizationSnapshot;

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(COLORS.text)
    .text("Invoice", PAGE.margin, PAGE.margin);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(org.name || "Organization", PAGE.width - PAGE.margin - 220, PAGE.margin, {
      width: 220,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text([org.address, org.email, org.phoneNumber, org.website].filter(Boolean).join("\n"), PAGE.width - PAGE.margin - 220, PAGE.margin + 18, {
      width: 220,
      align: "right",
      lineGap: 2,
    });

  const metaY = PAGE.margin + 72;
  doc
    .roundedRect(PAGE.margin, metaY, PAGE.width - PAGE.margin * 2, 76, 8)
    .fillAndStroke(COLORS.soft, COLORS.border);

  const fields: Array<[string, string]> = [
    ["Invoice #", invoice.invoiceNumber],
    ["Status", statusLabel(invoice.status)],
    ["Issue Date", date(invoice.issueDate)],
    ["Due Date", date(invoice.dueDate)],
    ["Payment Terms", invoice.paymentTerms || "-"],
    ["PO / Reference", invoice.poNumber || "-"],
  ];
  const columnWidth = (PAGE.width - PAGE.margin * 2 - 32) / 3;
  fields.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = PAGE.margin + 16 + col * columnWidth;
    const y = metaY + 14 + row * 34;
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(label, x, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text(value, x, y + 12, {
      width: columnWidth - 10,
      ellipsis: true,
    });
  });

  return metaY + 104;
}

function drawPartyBlocks(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): number {
  const blockWidth = (PAGE.width - PAGE.margin * 2 - 16) / 2;
  const customer = invoice.customerSnapshot;
  const blocks = [
    {
      title: "Bill To",
      lines: [
        customer.company || customer.name,
        customer.name,
        customer.billingAddress,
        customer.email,
        customer.contactNumber,
      ],
    },
    {
      title: "Ship To",
      lines: [customer.company || customer.name, customer.shippingAddress || customer.billingAddress],
    },
  ];

  blocks.forEach((block, index) => {
    const x = PAGE.margin + index * (blockWidth + 16);
    doc.roundedRect(x, startY, blockWidth, 104, 8).stroke(COLORS.border);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(block.title, x + 12, startY + 12);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(block.lines.filter(Boolean).join("\n") || "-", x + 12, startY + 30, {
        width: blockWidth - 24,
        lineGap: 2,
      });
  });

  return startY + 128;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const columns = [
    ["Item", 48, 150],
    ["HSN/SAC", 198, 52],
    ["Qty", 250, 34],
    ["Rate", 284, 58],
    ["Disc", 342, 42],
    ["GST", 384, 40],
    ["Taxable", 424, 58],
    ["Total", 482, 65],
  ] as const;

  doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 24).fill(COLORS.primary);
  columns.forEach(([label, x, width]) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#ffffff")
      .text(label, x, y + 8, { width, align: x >= 250 ? "right" : "left" });
  });
  return y + 24;
}

function drawLineItem(doc: PDFKit.PDFDocument, item: IInvoiceLineItem, y: number): number {
  const descriptionHeight = doc.heightOfString(item.description || "-", {
    width: 146,
    lineGap: 1,
  });
  const rowHeight = Math.max(32, descriptionHeight + 16);

  doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, rowHeight).stroke(COLORS.border);
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.text);
  fitText(doc, item.description, 52, y + 8, { width: 142, height: rowHeight - 12, lineGap: 1 });
  fitText(doc, item.hsnCode, 198, y + 8, { width: 50 });
  fitText(doc, String(item.quantity), 250, y + 8, { width: 34, align: "right" });
  fitText(doc, money(item.unitPrice), 284, y + 8, { width: 58, align: "right" });
  fitText(doc, `${item.discountPercentage}%`, 342, y + 8, { width: 42, align: "right" });
  fitText(doc, `${item.gstRate}%`, 384, y + 8, { width: 40, align: "right" });
  fitText(doc, money(item.taxableAmount), 424, y + 8, { width: 58, align: "right" });
  fitText(doc, money(item.totalAmount), 482, y + 8, { width: 65, align: "right" });

  return y + rowHeight;
}

function drawLineItems(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): number {
  let y = drawTableHeader(doc, startY);

  for (const item of invoice.lineItems) {
    const descriptionHeight = doc.heightOfString(item.description || "-", {
      width: 146,
      lineGap: 1,
    });
    const rowHeight = Math.max(32, descriptionHeight + 16);
    y = ensurePdfRoom(doc, y, rowHeight + 110);
    if (y === PAGE.margin) y = drawTableHeader(doc, y);
    y = drawLineItem(doc, item, y);
  }

  return y + 16;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): number {
  let y = ensurePdfRoom(doc, startY, 160);
  const x = PAGE.width - PAGE.margin - 220;
  const rows = [
    ["Subtotal", invoice.totals.subtotal],
    ["Discount", invoice.totals.discountTotal],
    ["Taxable Total", invoice.totals.taxableTotal],
    ["GST Total", invoice.totals.taxTotal],
    ["Grand Total", invoice.totals.grandTotal],
    ["Paid", invoice.totals.paidTotal],
    ["Balance Due", invoice.totals.balanceDue],
  ];

  rows.forEach(([label, value], index) => {
    const isGrand = label === "Grand Total" || label === "Balance Due";
    if (isGrand) {
      doc.moveTo(x, y).lineTo(x + 220, y).stroke(COLORS.border);
      y += 4;
    }
    doc
      .font(isGrand ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isGrand ? 11 : 9)
      .fillColor(label === "Balance Due" ? COLORS.danger : COLORS.text)
      .text(String(label), x, y, { width: 100 })
      .text(money(Number(value)), x + 110, y, { width: 110, align: "right" });
    y += isGrand ? 20 : 16;
  });

  return y + 12;
}

function drawNotes(doc: PDFKit.PDFDocument, invoice: PdfInvoice, startY: number): void {
  let y = ensurePdfRoom(doc, startY, 96);
  const sections: Array<[string, string]> = [
    ["Notes", invoice.notes],
    ["Terms & Conditions", invoice.termsAndConditions],
  ];

  sections.forEach(([title, content]) => {
    if (!content) return;
    const height = doc.heightOfString(content, { width: PAGE.width - PAGE.margin * 2, lineGap: 2 }) + 32;
    y = ensurePdfRoom(doc, y, height);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text(title, PAGE.margin, y);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(content, PAGE.margin, y + 16, { width: PAGE.width - PAGE.margin * 2, lineGap: 2 });
    y += height;
  });
}

export function createInvoicePdfDocument(invoice: PdfInvoice): PDFKit.PDFDocument {
  const doc = createBrandedPdfDocument({
    title: `Invoice ${invoice.invoiceNumber}`,
    author: invoice.organizationSnapshot.name,
    subject: "Invoice",
    keywords: "invoice, pdf",
  });

  let y = drawHeader(doc, invoice);
  y = drawPartyBlocks(doc, invoice, y);
  y = drawLineItems(doc, invoice, y);
  y = drawTotals(doc, invoice, y);
  drawNotes(doc, invoice, y);
  drawPdfFooter(doc, invoice.invoiceNumber);

  return doc;
}

export function streamInvoicePdf(invoice: PdfInvoice, res: Response): void {
  const filename = `${safePdfFilename(invoice.invoiceNumber)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = createInvoicePdfDocument(invoice);
  doc.pipe(res);
  doc.end();
}

export function renderInvoicePdfBuffer(invoice: PdfInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createInvoicePdfDocument(invoice);
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
