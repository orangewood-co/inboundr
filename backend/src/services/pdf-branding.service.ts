import PDFDocument from "pdfkit";

export const PDF_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 48,
  footerHeight: 36,
};

export const PDF_COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
  soft: "#f3f4f6",
  primary: "#111827",
  danger: "#b91c1c",
  white: "#ffffff",
};

export type PdfOrganizationBranding = {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  website?: string | null;
  primaryColor?: string | null;
  logoBuffer?: Buffer | null;
};

export function safePdfFilename(value: string, fallback = "download"): string {
  const safe = value.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
  return safe || fallback;
}

export function formatPdfDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parsed);
}

export function formatPdfDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function normalizePdfColor(value: string | null | undefined, fallback = PDF_COLORS.primary): string {
  if (!value) return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function createBrandedPdfDocument(options: {
  title: string;
  subject: string;
  author?: string | null;
  keywords?: string;
}): PDFKit.PDFDocument {
  return new PDFDocument({
    size: "A4",
    margins: {
      top: PDF_PAGE.margin,
      bottom: PDF_PAGE.margin,
      left: PDF_PAGE.margin,
      right: PDF_PAGE.margin,
    },
    bufferPages: true,
    compress: true,
    info: {
      Title: options.title,
      Author: options.author || "Inboundr",
      Subject: options.subject,
      Keywords: options.keywords,
    },
  });
}

export function drawPdfBrandHeader(
  doc: PDFKit.PDFDocument,
  options: {
    title: string;
    subtitle?: string | null;
    organization: PdfOrganizationBranding;
  }
): number {
  const primary = normalizePdfColor(options.organization.primaryColor);

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(PDF_COLORS.text)
    .text(options.title, PDF_PAGE.margin, PDF_PAGE.margin, {
      width: 260,
      lineGap: 2,
    });

  if (options.subtitle) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PDF_COLORS.muted)
      .text(options.subtitle, PDF_PAGE.margin, PDF_PAGE.margin + 34, {
        width: 260,
        lineGap: 2,
      });
  }

  const orgX = PDF_PAGE.width - PDF_PAGE.margin - 220;
  let orgY = PDF_PAGE.margin;
  if (options.organization.logoBuffer) {
    try {
      doc.image(options.organization.logoBuffer, orgX + 150, orgY, {
        fit: [70, 32],
        align: "right",
      });
      orgY += 38;
    } catch {
      orgY = PDF_PAGE.margin;
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(PDF_COLORS.text)
    .text(options.organization.name || "Organization", orgX, orgY, {
      width: 220,
      align: "right",
    });

  const orgLines = [
    options.organization.address,
    options.organization.email,
    options.organization.phoneNumber,
    options.organization.website,
  ].filter(Boolean);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(PDF_COLORS.muted)
    .text(orgLines.join("\n"), orgX, orgY + 18, {
      width: 220,
      align: "right",
      lineGap: 2,
    });

  doc
    .moveTo(PDF_PAGE.margin, PDF_PAGE.margin + 82)
    .lineTo(PDF_PAGE.width - PDF_PAGE.margin, PDF_PAGE.margin + 82)
    .lineWidth(2)
    .strokeColor(primary)
    .stroke()
    .lineWidth(1)
    .strokeColor(PDF_COLORS.border);

  return PDF_PAGE.margin + 104;
}

export function drawPdfFooter(doc: PDFKit.PDFDocument, reference: string): void {
  const range = doc.bufferedPageRange();
  const generated = `Generated ${formatPdfDate(new Date())}`;
  const safeReference = reference.replace(/\s+/g, " ").trim() || "PDF";

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerY = PDF_PAGE.height - PDF_PAGE.footerHeight;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PDF_COLORS.muted)
      .text(`${safeReference} · ${generated}`, PDF_PAGE.margin, footerY, {
        width: 320,
        height: 10,
        ellipsis: true,
        lineBreak: false,
      })
      .text(`Page ${index + 1} of ${range.count}`, PDF_PAGE.width - PDF_PAGE.margin - 100, footerY, {
        width: 100,
        height: 10,
        align: "right",
        lineBreak: false,
      });
  }
  doc.switchToPage(range.start + range.count - 1);
}

export function ensurePdfRoom(doc: PDFKit.PDFDocument, currentY: number, neededHeight: number): number {
  if (currentY + neededHeight <= PDF_PAGE.height - PDF_PAGE.margin - PDF_PAGE.footerHeight) return currentY;
  doc.addPage();
  return PDF_PAGE.margin;
}

export function drawPdfTextBlock(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  options: {
    font?: string;
    fontSize?: number;
    color?: string;
    width?: number;
    lineGap?: number;
  } = {}
): number {
  const width = options.width ?? PDF_PAGE.width - PDF_PAGE.margin * 2;
  const font = options.font ?? "Helvetica";
  const fontSize = options.fontSize ?? 9;
  const lineGap = options.lineGap ?? 2;
  const lineHeight = fontSize + lineGap + 2;
  const paragraphs = (text || "-").split(/\n{2,}/);
  let currentY = y;

  doc.font(font).fontSize(fontSize).fillColor(options.color ?? PDF_COLORS.text);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";

    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (doc.widthOfString(candidate) <= width || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (lines.length === 0) lines.push("-");

    lines.forEach((lineText) => {
      currentY = ensurePdfRoom(doc, currentY, lineHeight);
      doc.text(lineText, PDF_PAGE.margin, currentY, {
        width,
        height: lineHeight,
        lineBreak: false,
      });
      currentY += lineHeight;
    });

    if (paragraphIndex < paragraphs.length - 1) {
      currentY = ensurePdfRoom(doc, currentY, lineHeight);
      currentY += lineHeight / 2;
    }
  });

  return currentY + 10;
}

export function drawPdfKeyValueGrid(
  doc: PDFKit.PDFDocument,
  startY: number,
  fields: Array<[string, string | number | null | undefined]>,
  columns = 3
): number {
  const y = ensurePdfRoom(doc, startY, Math.ceil(fields.length / columns) * 34 + 28);
  const rows = Math.ceil(fields.length / columns);
  const boxHeight = rows * 34 + 28;
  const columnWidth = (PDF_PAGE.width - PDF_PAGE.margin * 2 - 32) / columns;

  doc
    .roundedRect(PDF_PAGE.margin, y, PDF_PAGE.width - PDF_PAGE.margin * 2, boxHeight, 8)
    .fillAndStroke(PDF_COLORS.soft, PDF_COLORS.border);

  fields.forEach(([label, value], index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = PDF_PAGE.margin + 16 + col * columnWidth;
    const cellY = y + 14 + row * 34;
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted).text(label, x, cellY);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(PDF_COLORS.text)
      .text(value == null || value === "" ? "-" : String(value), x, cellY + 12, {
        width: columnWidth - 10,
        ellipsis: true,
      });
  });

  return y + boxHeight + 24;
}

export function drawPdfSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  const nextY = ensurePdfRoom(doc, y, 28);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF_COLORS.text).text(title, PDF_PAGE.margin, nextY);
  return nextY + 20;
}

export function streamPdfDocument(doc: PDFKit.PDFDocument, filename: string, res: import("express").Response): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safePdfFilename(filename)}.pdf"`);
  doc.pipe(res);
  doc.end();
}
