import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import type { EmailAttachment } from "../types/email.types";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const MAX_PDF_PAGES = 4;
const MAX_EXTRACTED_CHARS_PER_ATTACHMENT = 12000;
const MAX_SPREADSHEET_SHEETS = 2;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 100;

const imageModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

export interface AttachmentExtractionInput {
  attachment: EmailAttachment;
  data: Buffer;
}

export interface AttachmentExtractionResult {
  filename: string;
  mimeType: string;
  text: string | null;
  warning: string | null;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SUPPORTED_SPREADSHEET_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function getAttachmentExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isSpreadsheetAttachment(attachment: EmailAttachment): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  const extension = getAttachmentExtension(attachment.filename);

  return (
    SUPPORTED_SPREADSHEET_MIME_TYPES.has(mimeType) ||
    extension === "csv" ||
    extension === "xls" ||
    extension === "xlsx"
  );
}

export function isSupportedRFQAttachment(attachment: EmailAttachment): boolean {
  return (
    attachment.mimeType === "application/pdf" ||
    SUPPORTED_IMAGE_MIME_TYPES.has(attachment.mimeType) ||
    isSpreadsheetAttachment(attachment)
  );
}

export function getSupportedRFQAttachments(
  attachments: EmailAttachment[]
): EmailAttachment[] {
  return attachments.filter(isSupportedRFQAttachment).slice(0, MAX_ATTACHMENTS);
}

function trimExtractedText(text: string): string {
  return text.trim().slice(0, MAX_EXTRACTED_CHARS_PER_ATTACHMENT);
}

async function extractPDFText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return trimExtractedText(result.text);
  } finally {
    await parser.destroy();
  }
}

function stringifyCell(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  }

  return String(cell).replace(/\s+/g, " ").trim();
}

function readSpreadsheetWorkbook(input: AttachmentExtractionInput): XLSX.WorkBook {
  const isCsv = getAttachmentExtension(input.attachment.filename) === "csv";

  if (isCsv) {
    return XLSX.read(input.data.toString("utf-8"), {
      type: "string",
      cellDates: true,
    });
  }

  return XLSX.read(input.data, { type: "buffer", cellDates: true });
}

function formatSpreadsheetRow(
  row: string[],
  headers: string[],
  rowNumber: number
): string | null {
  const values = row.map(stringifyCell);
  if (!values.some(Boolean)) return null;

  const cells = values
    .map((value, index) => {
      if (!value) return null;
      const header = headers[index] || `Column ${index + 1}`;
      return `${header}=${value}`;
    })
    .filter((cell): cell is string => Boolean(cell));

  return cells.length > 0 ? `ROW ${rowNumber}: ${cells.join("; ")}` : null;
}

async function extractSpreadsheetText(
  input: AttachmentExtractionInput
): Promise<string> {
  const workbook = readSpreadsheetWorkbook(input);
  const sheetSections: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, MAX_SPREADSHEET_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    const rows = rawRows
      .map((row) => row.map(stringifyCell))
      .filter((row) => row.some(Boolean));

    if (rows.length === 0) continue;

    const [headerRow = [], ...dataRows] = rows;
    const headers = headerRow.map((cell, index) => cell || `Column ${index + 1}`);
    const formattedRows = dataRows
      .slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET)
      .map((row, index) => formatSpreadsheetRow(row, headers, index + 1))
      .filter((row): row is string => Boolean(row));

    const section = [
      `SHEET: ${sheetName}`,
      `COLUMNS: ${headers.join(" | ")}`,
      ...formattedRows,
    ].join("\n");

    sheetSections.push(section);
  }

  return trimExtractedText(sheetSections.join("\n\n"));
}

async function extractImageText(input: AttachmentExtractionInput): Promise<string> {
  const dataUrl = `data:${input.attachment.mimeType};base64,${input.data.toString(
    "base64"
  )}`;

  const response = await imageModel.invoke([
    new SystemMessage(
      "Extract RFQ-relevant text from the image. Return only visible text and concise notes about products, quantities, specifications, contact details, and quote intent. If no relevant text is visible, return an empty string."
    ),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: `Attachment filename: ${input.attachment.filename}`,
        },
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    }),
  ]);

  return trimExtractedText(String(response.content ?? ""));
}

export async function extractRFQAttachmentText(
  input: AttachmentExtractionInput
): Promise<AttachmentExtractionResult> {
  const { attachment, data } = input;

  if (!isSupportedRFQAttachment(attachment)) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: "Unsupported attachment type",
    };
  }

  if (data.byteLength > MAX_ATTACHMENT_BYTES) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: `Attachment exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`,
    };
  }

  try {
    let text: string;

    if (attachment.mimeType === "application/pdf") {
      text = await extractPDFText(data);
    } else if (isSpreadsheetAttachment(attachment)) {
      text = await extractSpreadsheetText(input);
    } else {
      text = await extractImageText(input);
    }

    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: text || null,
      warning: text ? null : "No text extracted from attachment",
    };
  } catch (err: any) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: err?.message || "Attachment extraction failed",
    };
  }
}
