export type DocumentKind = "pdf" | "spreadsheet" | "text" | "unsupported";

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

export function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function detectDocumentKind(
  contentType: string | null,
  fileName: string
): DocumentKind {
  const mime = (contentType ?? "").toLowerCase();
  const ext = getExtension(fileName);

  if (PDF_MIME_TYPES.has(mime) || ext === "pdf") return "pdf";
  if (SPREADSHEET_MIME_TYPES.has(mime) || SPREADSHEET_EXTENSIONS.has(ext)) {
    return "spreadsheet";
  }
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  return "unsupported";
}
