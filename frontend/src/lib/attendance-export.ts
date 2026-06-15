import * as XLSX from "xlsx"

export type AttendanceExportRow = {
  employeeName: string
  employeeCode: string | null
  date: string
  status: string
  checkInAt: string | null
  checkOutAt: string | null
  source: string | null
  notes: string | null
}

const statusLabels: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  missing_checkout: "Missing Checkout",
  flagged: "Flagged",
}

const sourceLabels: Record<string, string> = {
  embed_pos: "POS",
  manual: "Manual",
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" })

function formatDateCell(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value
  return dateFormatter.format(new Date(year, month - 1, day))
}

function formatTimeCell(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date)
}

/** Decimal hours between check-in and check-out, blank when either is missing. */
function hoursWorked(checkInAt: string | null, checkOutAt: string | null): string {
  if (!checkInAt || !checkOutAt) return ""
  const start = new Date(checkInAt).getTime()
  const end = new Date(checkOutAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return ""
  return ((end - start) / 3_600_000).toFixed(2)
}

function toSheetRow(row: AttendanceExportRow) {
  return {
    Employee: row.employeeName,
    "Employee Code": row.employeeCode ?? "",
    Date: formatDateCell(row.date),
    Status: statusLabels[row.status] ?? row.status,
    "Check In": formatTimeCell(row.checkInAt),
    "Check Out": formatTimeCell(row.checkOutAt),
    "Hours Worked": hoursWorked(row.checkInAt, row.checkOutAt),
    Source: row.source ? sourceLabels[row.source] ?? row.source : "",
    Notes: row.notes ?? "",
  }
}

const columnWidths = [
  { wch: 26 }, // Employee
  { wch: 14 }, // Employee Code
  { wch: 14 }, // Date
  { wch: 16 }, // Status
  { wch: 10 }, // Check In
  { wch: 10 }, // Check Out
  { wch: 12 }, // Hours Worked
  { wch: 9 }, //  Source
  { wch: 32 }, // Notes
]

/** Build an Excel workbook from attendance rows and trigger a download. */
export function downloadAttendanceWorkbook(rows: AttendanceExportRow[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map(toSheetRow))
  worksheet["!cols"] = columnWidths
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance")
  XLSX.writeFile(workbook, filename)
}
