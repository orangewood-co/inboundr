import * as XLSX from "xlsx";

import {
  MAX_SPREADSHEET_ROWS_PER_SHEET,
  MAX_SPREADSHEET_SHEETS,
} from "../config";
import { getExtension } from "./detect";

function stringifyCell(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  }
  return String(cell).replace(/\s+/g, " ").trim();
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function rowsToMarkdownTable(rows: string[][]): string {
  const width = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]): string[] => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded.map(escapeCell);
  };

  const [header, ...body] = rows;
  const lines = [
    `| ${pad(header ?? []).join(" | ")} |`,
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map((row) => `| ${pad(row).join(" | ")} |`),
  ];
  return lines.join("\n");
}

/**
 * Converts a spreadsheet (csv/xls/xlsx) into markdown, one table per sheet.
 */
export function convertSpreadsheetToMarkdown(
  data: Buffer,
  fileName: string
): string {
  const ext = getExtension(fileName);
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
    sections.push(`## Sheet: ${sheetName}\n\n${rowsToMarkdownTable(rows)}`);
  }

  return sections.join("\n\n");
}
