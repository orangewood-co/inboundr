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

type PdfEmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
};

type PdfEmail = {
  _id: unknown;
  from: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  date: Date | string;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  labels?: string[];
  status: string;
  attachments?: PdfEmailAttachment[];
};

type PdfEmailClassification = {
  isRFQ?: boolean | null;
  reason?: string | null;
  errorMessage?: string | null;
};

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanEmailText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeQuotedPrintable(value)
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function selectBody(email: PdfEmail): string {
  const text = cleanEmailText(email.bodyText);
  if (text) return text;
  return cleanEmailText(stripHtml(email.bodyHtml || ""));
}

function drawAttachmentList(doc: PDFKit.PDFDocument, email: PdfEmail, y: number): number {
  const attachments = email.attachments ?? [];
  if (attachments.length === 0) return y;

  let currentY = drawPdfSectionTitle(doc, "Attachments", y);
  attachments.forEach((attachment) => {
    currentY = ensurePdfRoom(doc, currentY, 24);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PDF_COLORS.text)
      .text(attachment.filename || "Attachment", PDF_PAGE.margin, currentY, { width: 260, ellipsis: true })
      .fillColor(PDF_COLORS.muted)
      .text(attachment.mimeType || "-", PDF_PAGE.margin + 280, currentY, { width: 140, ellipsis: true })
      .text(`${Math.ceil((attachment.size || 0) / 1024)} KB`, PDF_PAGE.width - PDF_PAGE.margin - 80, currentY, {
        width: 80,
        align: "right",
      });
    currentY += 18;
  });

  return currentY + 8;
}

export function createEmailPdfDocument(options: {
  email: PdfEmail;
  organization: PdfOrganizationBranding;
  classification?: PdfEmailClassification | null;
}): PDFKit.PDFDocument {
  const { email, organization, classification } = options;
  const doc = createBrandedPdfDocument({
    title: email.subject || "Email",
    author: organization.name,
    subject: "Email",
    keywords: "email, inbox, pdf",
  });

  let y = drawPdfBrandHeader(doc, {
    title: "Email",
    subtitle: email.subject || "(no subject)",
    organization,
  });

  y = drawPdfKeyValueGrid(doc, y, [
    ["From", email.from],
    ["To", email.to],
    ["Date", formatPdfDateTime(email.date)],
    ["CC", email.cc],
    ["BCC", email.bcc],
    ["Status", email.status],
    ["RFQ", classification?.isRFQ == null ? "-" : classification.isRFQ ? "Yes" : "No"],
    ["Labels", email.labels?.join(", ") || "-"],
    ["Attachments", String(email.attachments?.length ?? 0)],
  ]);

  if (classification?.reason || classification?.errorMessage) {
    y = drawPdfSectionTitle(doc, "Classification", y);
    y = drawPdfTextBlock(doc, cleanEmailText([classification.reason, classification.errorMessage].filter(Boolean).join("\n")), y, {
      color: classification.errorMessage ? PDF_COLORS.danger : PDF_COLORS.text,
    });
  }

  if (email.snippet) {
    y = drawPdfSectionTitle(doc, "Snippet", y);
    y = drawPdfTextBlock(doc, cleanEmailText(email.snippet), y, { color: PDF_COLORS.muted });
  }

  const body = selectBody(email);
  y = drawPdfSectionTitle(doc, "Message", y);
  y = drawPdfTextBlock(doc, body || "-", y);
  if (email.bodyHtml?.includes("<img")) {
    y = drawPdfTextBlock(doc, "Note: inline email images are not embedded in this PDF export.", y, {
      color: PDF_COLORS.muted,
      fontSize: 8,
    });
  }
  y = drawAttachmentList(doc, email, y);

  drawPdfFooter(doc, email.subject || "Email");
  return doc;
}

export function streamEmailPdf(
  email: PdfEmail,
  organization: PdfOrganizationBranding,
  classification: PdfEmailClassification | null,
  res: Response
): void {
  const doc = createEmailPdfDocument({ email, organization, classification });
  const subject = safePdfFilename(email.subject || `email_${String(email._id)}`, "email");
  streamPdfDocument(doc, subject, res);
}
