import type { Response } from "express";
import type { IEmployeeDocument } from "../models/employee-document.model";
import {
  createBrandedPdfDocument,
  drawPdfBrandHeader,
  drawPdfFooter,
  drawPdfKeyValueGrid,
  drawPdfSectionTitle,
  drawPdfTextBlock,
  formatPdfDate,
  normalizePdfColor,
  PDF_COLORS,
  PDF_PAGE,
  streamPdfDocument,
  type PdfOrganizationBranding,
} from "./pdf-branding.service";

type EmployeeDocumentLike = Pick<
  IEmployeeDocument,
  "type" | "title" | "employeeSnapshot" | "issuedAt" | "createdAt"
>;

function employeeInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IN"
  );
}

function employeeCode(document: EmployeeDocumentLike): string {
  return document.employeeSnapshot.employeeCode || "Not assigned";
}

function drawIdCard(
  doc: PDFKit.PDFDocument,
  document: EmployeeDocumentLike,
  organization: PdfOrganizationBranding
): void {
  const primary = normalizePdfColor(organization.primaryColor, "#f97316");
  const snapshot = document.employeeSnapshot;
  const cardWidth = 320;
  const cardHeight = 440;
  const cardX = (PDF_PAGE.width - cardWidth) / 2;
  const cardY = 142;

  doc
    .roundedRect(cardX, cardY, cardWidth, cardHeight, 24)
    .fillAndStroke(PDF_COLORS.white, PDF_COLORS.border);

  doc
    .roundedRect(cardX, cardY, cardWidth, 112, 24)
    .fill(primary);
  doc.rect(cardX, cardY + 78, cardWidth, 58).fill(primary);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(PDF_COLORS.white)
    .text((organization.name || "Organization").toUpperCase(), cardX + 24, cardY + 24, {
      width: cardWidth - 48,
      characterSpacing: 1.2,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(PDF_COLORS.white)
    .text("Employee ID", cardX + 24, cardY + 56, {
      width: cardWidth - 48,
    });

  const avatarSize = 96;
  const avatarX = cardX + (cardWidth - avatarSize) / 2;
  const avatarY = cardY + 134;
  doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2).fill(PDF_COLORS.soft);
  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(PDF_COLORS.text)
    .text(employeeInitials(snapshot.fullName), avatarX, avatarY + 31, {
      width: avatarSize,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(PDF_COLORS.text)
    .text(snapshot.fullName, cardX + 24, cardY + 252, {
      width: cardWidth - 48,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(PDF_COLORS.muted)
    .text(snapshot.title || "Employee", cardX + 24, cardY + 282, {
      width: cardWidth - 48,
      align: "center",
    })
    .text(snapshot.teamName || "Unassigned", cardX + 24, cardY + 302, {
      width: cardWidth - 48,
      align: "center",
    });

  const infoY = cardY + 344;
  doc
    .roundedRect(cardX + 24, infoY, cardWidth - 48, 66, 14)
    .fillAndStroke(PDF_COLORS.soft, PDF_COLORS.border);

  doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted).text("EMPLOYEE ID", cardX + 42, infoY + 14);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF_COLORS.text).text(employeeCode(document), cardX + 42, infoY + 28);
  doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted).text("EMAIL", cardX + 150, infoY + 14);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_COLORS.text).text(snapshot.email, cardX + 150, infoY + 28, {
    width: cardWidth - 200,
    ellipsis: true,
  });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PDF_COLORS.muted)
    .text(`Issued ${formatPdfDate(document.issuedAt || document.createdAt)}`, cardX + 24, cardY + cardHeight - 34, {
      width: cardWidth - 48,
      align: "center",
    });
}

function drawProofOfEmployment(
  doc: PDFKit.PDFDocument,
  document: EmployeeDocumentLike,
  organization: PdfOrganizationBranding
): void {
  const snapshot = document.employeeSnapshot;
  let y = drawPdfBrandHeader(doc, {
    title: "Proof of Employment",
    subtitle: `Issued ${formatPdfDate(document.issuedAt || document.createdAt)}`,
    organization,
  });

  y = drawPdfKeyValueGrid(doc, y, [
    ["Employee", snapshot.fullName],
    ["Employee ID", snapshot.employeeCode || "Not assigned"],
    ["Title", snapshot.title || "Employee"],
    ["Team", snapshot.teamName || "Unassigned"],
    ["Start date", formatPdfDate(snapshot.startDate)],
    ["Email", snapshot.email],
  ], 2);

  y = drawPdfSectionTitle(doc, "Certification", y);
  const organizationName = organization.name || "the organization";
  const paragraph = [
    `This is to certify that ${snapshot.fullName} is employed with ${organizationName}`,
    `as ${snapshot.title || "Employee"}${snapshot.teamName ? ` in the ${snapshot.teamName} team` : ""}.`,
    `Employment start date: ${formatPdfDate(snapshot.startDate)}.`,
    "",
    "This document has been generated from Inboundr employee records and is intended for employment verification purposes.",
  ].join(" ");
  y = drawPdfTextBlock(doc, paragraph, y, { fontSize: 11, lineGap: 5 });

  const signatureY = Math.max(y + 52, PDF_PAGE.height - 210);
  doc
    .moveTo(PDF_PAGE.margin, signatureY)
    .lineTo(PDF_PAGE.margin + 210, signatureY)
    .strokeColor(PDF_COLORS.border)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(PDF_COLORS.text)
    .text("Authorized Signatory", PDF_PAGE.margin, signatureY + 12);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(PDF_COLORS.muted)
    .text(organization.name || "Organization", PDF_PAGE.margin, signatureY + 28);
}

export function createEmployeeDocumentPdf(options: {
  document: EmployeeDocumentLike;
  organization: PdfOrganizationBranding;
}): PDFKit.PDFDocument {
  const { document, organization } = options;
  const doc = createBrandedPdfDocument({
    title: document.title,
    subject: document.type === "id_card" ? "Employee identity card" : "Proof of employment",
    author: organization.name,
    keywords: "employee,hr,identity,employment",
  });

  if (document.type === "id_card") {
    drawIdCard(doc, document, organization);
  } else {
    drawProofOfEmployment(doc, document, organization);
  }

  drawPdfFooter(doc, `${document.title} · ${document.employeeSnapshot.fullName}`);
  return doc;
}

export function streamEmployeeDocumentPdf(options: {
  document: EmployeeDocumentLike;
  organization: PdfOrganizationBranding;
  res: Response;
  disposition?: "attachment" | "inline";
}): void {
  const { document, organization, res, disposition = "attachment" } = options;
  const doc = createEmployeeDocumentPdf({ document, organization });
  const prefix = document.type === "id_card" ? "employee-id-card" : "proof-of-employment";
  streamPdfDocument(doc, `${prefix}-${document.employeeSnapshot.fullName}`, res, { disposition });
}
