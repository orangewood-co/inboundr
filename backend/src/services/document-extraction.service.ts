import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

import type { IDriveNode } from "../models/drive-node.model";
import { getObjectBuffer } from "./storage.service";

// Cap extracted text per file to keep embedding cost and storage bounded.
const MAX_EXTRACTED_CHARS = 200_000;
const MAX_PDF_PAGES = 50;
const MAX_SPREADSHEET_SHEETS = 10;
const MAX_SPREADSHEET_ROWS_PER_SHEET = 2_000;

export type DocumentExtractionResult =
  | { status: "extracted"; text: string }
  | { status: "empty" }
  | { status: "unsupported" };

const PDF_MIME_TYPES = new Set(["application/pdf"]);

const SPREADSHEET_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const SPREADSHEET_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "log",
  "yaml",
  "yml",
  "html",
  "htm",
  "xml",
]);

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isPdf(contentType: string, ext: string): boolean {
  return PDF_MIME_TYPES.has(contentType) || ext === "pdf";
}

function isSpreadsheet(contentType: string, ext: string): boolean {
  return SPREADSHEET_MIME_TYPES.has(contentType) || SPREADSHEET_EXTENSIONS.has(ext);
}

function isTextLike(contentType: string, ext: string): boolean {
  return contentType.startsWith("text/") || TEXT_EXTENSIONS.has(ext);
}

function trim(text: string): string {
  return text.trim().slice(0, MAX_EXTRACTED_CHARS);
}

/**
 * Determines whether a node's content type / name is supported for indexing,
 * without fetching the file. Used to short-circuit unsupported files early.
 */
export function isExtractableNode(node: Pick<IDriveNode, "contentType" | "name" | "type">): boolean {
  if (node.type !== "file") return false;
  const contentType = (node.contentType ?? "").toLowerCase();
  const ext = getExtension(node.name);
  return isPdf(contentType, ext) || isSpreadsheet(contentType, ext) || isTextLike(contentType, ext);
}

async function extractPdf(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return trim(result.text);
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

function extractSpreadsheet(data: Buffer, ext: string): string {
  const workbook =
    ext === "csv"
      ? XLSX.read(data.toString("utf-8"), { type: "string", cellDates: true })
      : XLSX.read(data, { type: "buffer", cellDates: true });

  const sections: string[] = [];
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
      .filter((row) => row.some(Boolean))
      .slice(0, MAX_SPREADSHEET_ROWS_PER_SHEET);

    if (rows.length === 0) continue;
    sections.push(`SHEET: ${sheetName}\n${rows.map((row) => row.join(" | ")).join("\n")}`);
  }

  return trim(sections.join("\n\n"));
}

/**
 * Fetches a Drive file from storage and extracts plain text suitable for
 * embedding. Reuses the same parser stack as RFQ attachment extraction.
 */
export async function extractDriveNodeText(
  node: IDriveNode
): Promise<DocumentExtractionResult> {
  if (node.type !== "file" || !node.storageKey) {
    return { status: "unsupported" };
  }

  const contentType = (node.contentType ?? "").toLowerCase();
  const ext = getExtension(node.name);

  if (!isPdf(contentType, ext) && !isSpreadsheet(contentType, ext) && !isTextLike(contentType, ext)) {
    return { status: "unsupported" };
  }

  const buffer = await getObjectBuffer(node.storageKey);

  let text = "";
  if (isPdf(contentType, ext)) {
    text = await extractPdf(buffer);
  } else if (isSpreadsheet(contentType, ext)) {
    text = extractSpreadsheet(buffer, ext);
  } else {
    text = trim(buffer.toString("utf-8"));
  }

  return text.length > 0 ? { status: "extracted", text } : { status: "empty" };
}
