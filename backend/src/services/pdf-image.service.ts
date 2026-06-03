import sharp from "sharp";
import QRCode from "qrcode";
import { getObjectBuffer } from "./storage.service";
import type { IEmployeeDocumentSnapshot } from "../models/employee-document.model";

export async function loadPngBuffer(key: string | null | undefined): Promise<Buffer | null> {
  const normalized = String(key ?? "").trim();
  if (!normalized) return null;

  try {
    const source = await getObjectBuffer(normalized);
    return await sharp(source).png().toBuffer();
  } catch (err) {
    console.warn(`Failed to load image as PNG for key ${normalized}:`, err);
    return null;
  }
}

function escapeVCardValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildEmployeeVCard(snapshot: IEmployeeDocumentSnapshot): string {
  const fullName = escapeVCardValue(snapshot.fullName || "");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    `N:${fullName};;;;`,
  ];
  if (snapshot.title) lines.push(`TITLE:${escapeVCardValue(snapshot.title)}`);
  if (snapshot.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(snapshot.email)}`);
  if (snapshot.phone) lines.push(`TEL;TYPE=CELL:${escapeVCardValue(snapshot.phone)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export async function generateVCardQrPng(snapshot: IEmployeeDocumentSnapshot): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(buildEmployeeVCard(snapshot), {
      type: "png",
      margin: 1,
      errorCorrectionLevel: "M",
      width: 320,
    });
  } catch (err) {
    console.warn("Failed to generate vCard QR code:", err);
    return null;
  }
}
