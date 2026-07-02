import type { IDriveNode } from "../models/drive-node.model";

// Extraction/conversion itself now happens in the document pipeline Lambda
// (@btsa/document-processor). The backend only keeps the cheap type detection
// used to short-circuit unsupported files before enqueueing.

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

/**
 * Determines whether a node's content type / name is supported for indexing,
 * without fetching the file. Used to short-circuit unsupported files early.
 * Must stay in sync with detectDocumentKind in @btsa/document-processor.
 */
export function isExtractableNode(node: Pick<IDriveNode, "contentType" | "name" | "type">): boolean {
  if (node.type !== "file") return false;
  const contentType = (node.contentType ?? "").toLowerCase();
  const ext = getExtension(node.name);
  return isPdf(contentType, ext) || isSpreadsheet(contentType, ext) || isTextLike(contentType, ext);
}
