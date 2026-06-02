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

export interface EmployeeDocumentPdfAssets {
  photoBuffer?: Buffer | null;
  qrBuffer?: Buffer | null;
}

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
  organization: PdfOrganizationBranding,
  assets: EmployeeDocumentPdfAssets
): void {
  const primary = normalizePdfColor(organization.primaryColor, "#f97316");
  const snapshot = document.employeeSnapshot;

  const cardWidth = 380;
  const cardHeight = 530;
  const cardX = (PDF_PAGE.width - cardWidth) / 2;
  const cardY = 110;
  const sidebarWidth = 48;
  const contentWidth = cardWidth - sidebarWidth;
  const contentCenterX = cardX + contentWidth / 2;
  const headerHeight = 86;

  // Card background, header band, and sidebar (clipped to rounded corners).
  doc.save();
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 22).clip();
  doc.rect(cardX, cardY, cardWidth, cardHeight).fill(PDF_COLORS.white);
  doc.rect(cardX, cardY, contentWidth, headerHeight).fill(primary);
  doc.rect(cardX + cardWidth - sidebarWidth, cardY, sidebarWidth, cardHeight).fill(primary);
  doc.restore();

  doc
    .roundedRect(cardX, cardY, cardWidth, cardHeight, 22)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.border)
    .stroke();

  // Header: large company logo (no company text).
  let logoRendered = false;
  if (organization.logoBuffer) {
    try {
      const logoBoxHeight = headerHeight - 24;
      const logoBoxWidth = contentWidth - 48;
      doc.image(organization.logoBuffer, cardX + 24, cardY + 12, {
        fit: [logoBoxWidth, logoBoxHeight],
        align: "center",
        valign: "center",
      });
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }

  if (!logoRendered) {
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(PDF_COLORS.white)
      .text((organization.name || "Organization").toUpperCase(), cardX + 24, cardY + headerHeight / 2 - 12, {
        width: contentWidth - 48,
        align: "center",
        characterSpacing: 1,
        lineBreak: false,
        ellipsis: true,
      });
  }

  // Vertical role/title sidebar.
  const role = (snapshot.title || "Employee").toUpperCase();
  const sidebarCenterX = cardX + cardWidth - sidebarWidth / 2;
  const sidebarCenterY = cardY + cardHeight / 2;
  doc.save();
  doc.rotate(-90, { origin: [sidebarCenterX, sidebarCenterY] });
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(PDF_COLORS.white)
    .text(role, sidebarCenterX - (cardHeight / 2 - 24), sidebarCenterY - 8, {
      width: cardHeight - 48,
      align: "center",
      characterSpacing: 1.5,
      lineBreak: false,
    });
  doc.restore();

  // Employee photo (or initials fallback).
  const photoSize = 150;
  const photoX = contentCenterX - photoSize / 2;
  const photoY = cardY + headerHeight + 24;
  if (assets.photoBuffer) {
    try {
      doc.save();
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 14).clip();
      doc.image(assets.photoBuffer, photoX, photoY, {
        cover: [photoSize, photoSize],
        align: "center",
        valign: "center",
      });
      doc.restore();
      doc
        .roundedRect(photoX, photoY, photoSize, photoSize, 14)
        .lineWidth(2)
        .strokeColor(primary)
        .stroke();
    } catch {
      drawInitialsBlock(doc, snapshot.fullName, photoX, photoY, photoSize, primary);
    }
  } else {
    drawInitialsBlock(doc, snapshot.fullName, photoX, photoY, photoSize, primary);
  }

  // Name + role + team.
  const nameY = photoY + photoSize + 20;
  doc
    .font("Helvetica-Bold")
    .fontSize(21)
    .fillColor(primary)
    .text(snapshot.fullName, cardX + 24, nameY, {
      width: contentWidth - 48,
      align: "center",
      lineBreak: true,
    });

  const metaY = nameY + 30;
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(PDF_COLORS.muted)
    .text(`${snapshot.title || "Employee"} · ${snapshot.teamName || "Unassigned"}`, cardX + 24, metaY, {
      width: contentWidth - 48,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });

  // Info rows: ID No / Email / Phone.
  const infoX = cardX + 30;
  const valueX = infoX + 66;
  const infoWidth = contentWidth - 60;
  let infoY = metaY + 28;
  const infoRows: Array<[string, string]> = [
    ["ID No", employeeCode(document)],
    ["Email", snapshot.email || "-"],
    ["Phone", snapshot.phone || "-"],
  ];
  infoRows.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COLORS.muted).text(label, infoX, infoY, {
      width: 60,
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.text).text(value, valueX, infoY - 1, {
      width: infoWidth - 66,
      lineBreak: false,
      ellipsis: true,
    });
    infoY += 22;
  });

  // vCard QR + issued date near the bottom.
  const qrSize = 84;
  const qrX = contentCenterX - qrSize / 2;
  const qrY = cardY + cardHeight - qrSize - 40;
  if (assets.qrBuffer) {
    try {
      doc.image(assets.qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
    } catch {
      // ignore QR render failure
    }
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PDF_COLORS.muted)
    .text(`Issued ${formatPdfDate(document.issuedAt || document.createdAt)}`, cardX + 24, cardY + cardHeight - 24, {
      width: contentWidth - 48,
      align: "center",
      lineBreak: false,
    });
}

function drawInitialsBlock(
  doc: PDFKit.PDFDocument,
  fullName: string,
  x: number,
  y: number,
  size: number,
  primary: string
): void {
  doc.roundedRect(x, y, size, size, 14).fillAndStroke(PDF_COLORS.soft, primary);
  doc
    .font("Helvetica-Bold")
    .fontSize(48)
    .fillColor(primary)
    .text(employeeInitials(fullName), x, y + size / 2 - 30, {
      width: size,
      align: "center",
      lineBreak: false,
    });
}

function drawProofOfEmployment(
  doc: PDFKit.PDFDocument,
  document: EmployeeDocumentLike,
  organization: PdfOrganizationBranding,
  assets: EmployeeDocumentPdfAssets
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

  // vCard QR for verification / saving contact.
  if (assets.qrBuffer) {
    const qrSize = 84;
    const qrX = PDF_PAGE.width - PDF_PAGE.margin - qrSize;
    const qrY = signatureY - 18;
    try {
      doc.image(assets.qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(PDF_COLORS.muted)
        .text("Scan to save contact", qrX - 18, qrY + qrSize + 4, {
          width: qrSize + 36,
          align: "center",
          lineBreak: false,
        });
    } catch {
      // ignore QR render failure
    }
  }
}

export function createEmployeeDocumentPdf(options: {
  document: EmployeeDocumentLike;
  organization: PdfOrganizationBranding;
  assets?: EmployeeDocumentPdfAssets;
}): PDFKit.PDFDocument {
  const { document, organization, assets = {} } = options;
  const doc = createBrandedPdfDocument({
    title: document.title,
    subject: document.type === "id_card" ? "Employee identity card" : "Proof of employment",
    author: organization.name,
    keywords: "employee,hr,identity,employment",
  });

  if (document.type === "id_card") {
    drawIdCard(doc, document, organization, assets);
  } else {
    drawProofOfEmployment(doc, document, organization, assets);
  }

  drawPdfFooter(doc, `${document.title} · ${document.employeeSnapshot.fullName}`);
  return doc;
}

export function streamEmployeeDocumentPdf(options: {
  document: EmployeeDocumentLike;
  organization: PdfOrganizationBranding;
  res: Response;
  assets?: EmployeeDocumentPdfAssets;
  disposition?: "attachment" | "inline";
}): void {
  const { document, organization, res, assets, disposition = "attachment" } = options;
  const doc = createEmployeeDocumentPdf({ document, organization, assets });
  const prefix = document.type === "id_card" ? "employee-id-card" : "proof-of-employment";
  streamPdfDocument(doc, `${prefix}-${document.employeeSnapshot.fullName}`, res, { disposition });
}
