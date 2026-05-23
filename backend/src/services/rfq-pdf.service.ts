import type { Response } from "express";
import {
  createBrandedPdfDocument,
  drawPdfBrandHeader,
  drawPdfFooter,
  drawPdfKeyValueGrid,
  drawPdfSectionTitle,
  drawPdfTextBlock,
  ensurePdfRoom,
  formatPdfDateTime,
  PDF_COLORS,
  PDF_PAGE,
  safePdfFilename,
  streamPdfDocument,
  type PdfOrganizationBranding,
} from "./pdf-branding.service";

type PdfRFQEmail = {
  subject?: string | null;
  from?: string | null;
  date?: Date | string | null;
  snippet?: string | null;
  status?: string | null;
};

type PdfRFQ = {
  _id: unknown;
  emailId?: PdfRFQEmail | null;
  isRFQ: boolean;
  reason: string;
  isProcessed: boolean;
  customer?: {
    name: string;
    company: string;
    email: string;
    contactNumber: string | null;
    address: string | null;
  } | null;
  queryProducts?: Array<{ name: string; quantity: number }>;
  searchResults?: Array<{
    query: { name: string; quantity: number };
    status: "matched" | "ambiguous" | "no_match";
    matchedBrand: string | null;
    matches: Array<{
      brand: string | null;
      description: string | null;
      code: string | null;
      price: number | null;
      hsnCode: string | null;
      gstRate: number | null;
      score: number;
      matchReasons: string[];
    }>;
  }>;
  errorMessage?: string | null;
  createdAt: Date | string;
};

function statusLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function drawParagraph(doc: PDFKit.PDFDocument, text: string, y: number, color = PDF_COLORS.text): number {
  return drawPdfTextBlock(doc, text || "-", y, { color });
}

function drawCustomer(doc: PDFKit.PDFDocument, rfq: PdfRFQ, y: number): number {
  if (!rfq.customer) return y;
  let currentY = drawPdfSectionTitle(doc, "Customer", y);
  return drawPdfKeyValueGrid(doc, currentY, [
    ["Name", rfq.customer.name],
    ["Company", rfq.customer.company],
    ["Email", rfq.customer.email],
    ["Phone", rfq.customer.contactNumber],
    ["Address", rfq.customer.address],
  ], 2);
}

function drawRequestedProducts(doc: PDFKit.PDFDocument, rfq: PdfRFQ, y: number): number {
  const products = rfq.queryProducts ?? [];
  if (products.length === 0) return y;
  let currentY = drawPdfSectionTitle(doc, "Requested Products", y);

  products.forEach((product) => {
    currentY = ensurePdfRoom(doc, currentY, 22);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PDF_COLORS.text)
      .text(product.name, PDF_PAGE.margin, currentY, { width: 360, ellipsis: true })
      .fillColor(PDF_COLORS.muted)
      .text(`Qty ${product.quantity}`, PDF_PAGE.width - PDF_PAGE.margin - 100, currentY, {
        width: 100,
        align: "right",
      });
    currentY += 18;
  });

  return currentY + 12;
}

function drawSearchResults(doc: PDFKit.PDFDocument, rfq: PdfRFQ, y: number): number {
  const searchResults = rfq.searchResults ?? [];
  if (searchResults.length === 0) return y;
  let currentY = drawPdfSectionTitle(doc, "Product Matches", y);

  searchResults.forEach((result) => {
    currentY = ensurePdfRoom(doc, currentY, 54);
    doc
      .roundedRect(PDF_PAGE.margin, currentY, PDF_PAGE.width - PDF_PAGE.margin * 2, 42, 6)
      .stroke(PDF_COLORS.border);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(PDF_COLORS.text)
      .text(result.query.name, PDF_PAGE.margin + 12, currentY + 10, { width: 320, height: 12, ellipsis: true })
      .fillColor(PDF_COLORS.muted)
      .font("Helvetica")
      .text(`Qty ${result.query.quantity} · ${statusLabel(result.status)}`, PDF_PAGE.margin + 12, currentY + 24, {
        width: 320,
        height: 12,
        ellipsis: true,
      })
      .text(result.matchedBrand || "-", PDF_PAGE.width - PDF_PAGE.margin - 160, currentY + 10, {
        width: 148,
        height: 12,
        align: "right",
        ellipsis: true,
      });
    currentY += 50;

    result.matches.slice(0, 3).forEach((match, index) => {
      currentY = ensurePdfRoom(doc, currentY, 48);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(PDF_COLORS.text)
        .text(`${index + 1}. ${match.description || match.code || "Matched product"}`, PDF_PAGE.margin + 12, currentY, {
          width: 300,
          height: 12,
          ellipsis: true,
        })
        .font("Helvetica")
        .fillColor(PDF_COLORS.muted)
        .text([match.brand, match.code, match.hsnCode ? `HSN ${match.hsnCode}` : null].filter(Boolean).join(" · ") || "-", PDF_PAGE.margin + 12, currentY + 14, {
          width: 300,
          height: 12,
          ellipsis: true,
        })
        .text(money(match.price), PDF_PAGE.width - PDF_PAGE.margin - 130, currentY, {
          width: 70,
          height: 12,
          align: "right",
        })
        .text(`${Math.round(match.score * 100)}%`, PDF_PAGE.width - PDF_PAGE.margin - 52, currentY, {
          width: 52,
          height: 12,
          align: "right",
        });
      currentY += 34;
    });

    currentY += 8;
  });

  return currentY;
}

export function createRFQPdfDocument(options: {
  rfq: PdfRFQ;
  organization: PdfOrganizationBranding;
}): PDFKit.PDFDocument {
  const { rfq, organization } = options;
  const email = rfq.emailId;
  const subject = email?.subject || "RFQ";
  const doc = createBrandedPdfDocument({
    title: subject,
    author: organization.name,
    subject: "RFQ",
    keywords: "rfq, request for quote, pdf",
  });

  let y = drawPdfBrandHeader(doc, {
    title: "RFQ",
    subtitle: subject,
    organization,
  });

  y = drawPdfKeyValueGrid(doc, y, [
    ["From", email?.from],
    ["Email Date", formatPdfDateTime(email?.date)],
    ["Captured", formatPdfDateTime(rfq.createdAt)],
    ["Processed", rfq.isProcessed ? "Yes" : "No"],
    ["Source Status", email?.status],
    ["RFQ Status", rfq.errorMessage ? "Error" : rfq.isRFQ ? "RFQ" : "Not RFQ"],
  ]);

  y = drawPdfSectionTitle(doc, "Classification", y);
  y = drawParagraph(doc, rfq.errorMessage || rfq.reason || "-", y, rfq.errorMessage ? PDF_COLORS.danger : PDF_COLORS.text);

  if (email?.snippet) {
    y = drawPdfSectionTitle(doc, "Source Email Snippet", y);
    y = drawParagraph(doc, email.snippet, y, PDF_COLORS.muted);
  }

  y = drawCustomer(doc, rfq, y);
  y = drawRequestedProducts(doc, rfq, y);
  y = drawSearchResults(doc, rfq, y);

  drawPdfFooter(doc, subject);
  return doc;
}

export function streamRFQPdf(rfq: PdfRFQ, organization: PdfOrganizationBranding, res: Response): void {
  const doc = createRFQPdfDocument({ rfq, organization });
  const subject = rfq.emailId?.subject || `rfq_${String(rfq._id)}`;
  streamPdfDocument(doc, `rfq_${safePdfFilename(subject, String(rfq._id))}`, res);
}
