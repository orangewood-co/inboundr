import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import * as XLSX from "xlsx"
import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDefaultLayout } from "react-resizable-panels"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SenderHoverCard } from "@/components/contact-hover-card"
import { CopyableText, CopyButton } from "@/components/copy-button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { openDownload } from "@/lib/downloads"
import { formatFullDateTime, formatListTimestamp } from "@/lib/format"
import { getAvatarColor } from "@/lib/utils"
import { toast } from "sonner"
import {
  InboxIcon,
  MailOpenIcon,
  PaperclipIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  AlertCircleIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  ChevronDownIcon,
  FileTextIcon,
} from "lucide-react"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/email`
const SPREADSHEET_PREVIEW_ROW_LIMIT = 200
const SPREADSHEET_PREVIEW_COLUMN_LIMIT = 30

interface EmailSummary {
  _id: string
  messageId: string
  threadId: string
  gmailAccountEmail: string | null
  from: string
  to: string
  subject: string
  snippet: string | null
  date: string
  status: "received" | "processing" | "processed" | "failed"
  labels: string[]
  attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[]
  rfqId: string | null
  isRFQ: boolean | null
  classificationReason: string | null
  rfqErrorMessage: string | null
}

type EmailAttachment = EmailSummary["attachments"][number]

interface EmailDetail extends EmailSummary {
  cc: string | null
  bcc: string | null
  bodyText: string | null
  bodyHtml: string | null
}

interface ListResponse {
  emails: EmailSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const EMAIL_VIEWER_STYLE = `
  <style>
    :root {
      color-scheme: light;
      background: #ffffff;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background: #ffffff;
    }

    body {
      box-sizing: border-box;
      padding: 32px 40px !important;
      color: #1a1a1a;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    table {
      max-width: 100%;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    pre {
      white-space: pre-wrap;
      overflow-x: auto;
    }

    * {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    *:hover {
      scrollbar-color: rgba(0,0,0,0.15) transparent;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 9999px;
    }
    *:hover::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.15);
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(0,0,0,0.3);
    }
  </style>
`

function buildEmailDocument(bodyHtml: string): string {
  const trimmed = bodyHtml.trim()
  const hasHtmlDocument = /<(?:!doctype|html|head|body)\b/i.test(trimmed)

  if (!hasHtmlDocument) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${EMAIL_VIEWER_STYLE}
</head>
<body>${bodyHtml}</body>
</html>`
  }

  const withCharset = /<head\b[^>]*>/i.test(trimmed)
    ? trimmed.replace(/<head\b[^>]*>/i, (match) => `${match}\n<meta charset="utf-8">\n${EMAIL_VIEWER_STYLE}`)
    : trimmed.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>\n<meta charset="utf-8">\n${EMAIL_VIEWER_STYLE}\n</head>`)

  if (withCharset !== trimmed) return withCharset

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${EMAIL_VIEWER_STYLE}
</head>
${trimmed}
</html>`
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+)>$/)
  if (match) return { name: match[1].trim(), email: match[2] }
  return { name: from, email: from }
}

function parseRecipients(raw: string | null): { name: string; email: string }[] {
  if (!raw) return []
  const parts: string[] = []
  let buf = ""
  let depth = 0
  for (const ch of raw) {
    if (ch === "<") depth++
    else if (ch === ">") depth = Math.max(0, depth - 1)
    if (ch === "," && depth === 0) {
      parts.push(buf)
      buf = ""
    } else {
      buf += ch
    }
  }
  if (buf) parts.push(buf)
  return parts.map((p) => p.trim()).filter(Boolean).map(parseSender)
}

function RecipientList({
  recipients,
}: {
  recipients: { name: string; email: string }[]
}) {
  return (
    <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
      {recipients.map((r, i) => {
        const colors = getAvatarColor(r.name)
        return (
          <div
            key={`${r.email}-${i}`}
            className="group/row flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/50"
          >
            <SenderHoverCard name={r.name} email={r.email} side="left">
              <div
                className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[11px] font-semibold ${colors.bg} ${colors.text}`}
              >
                {r.name.charAt(0).toUpperCase()}
              </div>
            </SenderHoverCard>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium leading-tight">{r.name}</p>
              {r.email !== r.name && (
                <p className="truncate text-[11px] leading-tight text-muted-foreground/60">
                  {r.email}
                </p>
              )}
            </div>
            <CopyButton value={r.email} label="Email copied" className="shrink-0" />
          </div>
        )
      })}
    </div>
  )
}

function RecipientSection({
  label,
  raw,
}: {
  label: string
  raw: string
}) {
  const recipients = parseRecipients(raw)
  if (recipients.length === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {recipients.length}
          </span>
        </div>
        <CopyButton value={raw} label={`${label} copied`} className="opacity-100" />
      </div>
      <RecipientList recipients={recipients} />
    </div>
  )
}

function RecipientsBar({ to, cc }: { to: string; cc: string | null }) {
  const toRecipients = parseRecipients(to)
  const ccRecipients = parseRecipients(cc)
  const total = toRecipients.length + ccRecipients.length

  const preview = toRecipients
    .slice(0, 2)
    .map((r) => r.name)
    .join(", ")
  const extraTo = Math.max(0, toRecipients.length - 2)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/recipients flex w-full items-center gap-2 rounded-md py-1 text-left text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            To
          </span>
          <span className="min-w-0 flex-1 truncate">
            {preview}
            {extraTo > 0 && <span className="text-muted-foreground/50"> +{extraTo}</span>}
            {ccRecipients.length > 0 && (
              <span className="text-muted-foreground/50">
                {"  ·  "}
                <span className="font-heading font-bold uppercase tracking-widest">Cc</span>{" "}
                {ccRecipients.length}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/50 group-hover/recipients:text-muted-foreground">
            {total} {total === 1 ? "recipient" : "recipients"}
            <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]/recipients:rotate-180" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[clamp(20rem,32vw,26rem)] space-y-4">
        <RecipientSection label="To" raw={to} />
        {cc && <RecipientSection label="Cc" raw={cc} />}
      </PopoverContent>
    </Popover>
  )
}

function buildGmailUrl(email: Pick<EmailSummary, "threadId" | "messageId" | "gmailAccountEmail">): string {
  const gmailId = email.threadId || email.messageId
  const authUser = email.gmailAccountEmail ? `?authuser=${encodeURIComponent(email.gmailAccountEmail)}` : ""
  return `https://mail.google.com/mail/${authUser}#inbox/${encodeURIComponent(gmailId)}`
}

const statusConfig = {
  received: {
    label: "Received",
    description: "Email received and queued for processing",
    dotClass: "bg-info",
    pillClass: "bg-info/10 text-info",
  },
  processing: {
    label: "Processing",
    description: "AI is classifying this email",
    dotClass: "bg-warning animate-pulse",
    pillClass: "bg-warning/10 text-warning",
  },
  processed: {
    label: "Processed",
    description: "Classification complete",
    dotClass: "bg-success",
    pillClass: "bg-success/10 text-success",
  },
  failed: {
    label: "Failed",
    description: "Processing failed — check error details",
    dotClass: "bg-destructive",
    pillClass: "bg-destructive/10 text-destructive",
  },
}

function StatusBadge({ status }: { status: EmailSummary["status"] }) {
  const config = statusConfig[status]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.pillClass}`}>
          <span className={`size-1.5 rounded-full ${config.dotClass}`} />
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{config.description}</TooltipContent>
    </Tooltip>
  )
}

function ClassificationBadge({ email }: { email: EmailSummary }) {
  const reason = email.classificationReason

  if (email.status === "failed" || email.rfqErrorMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            RFQ failed
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {email.rfqErrorMessage || "Processing failed"}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (email.isRFQ === true) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
            RFQ
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {reason || "Classified as a Request for Quotation"}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (email.isRFQ === false) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Not RFQ
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {reason || "Not a Request for Quotation"}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
          Pending
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Waiting for classification</TooltipContent>
    </Tooltip>
  )
}

const SPREADSHEET_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

function getAttachmentExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

function isSpreadsheetAttachment(att: EmailAttachment) {
  const mimeType = att.mimeType.toLowerCase()
  const extension = getAttachmentExtension(att.filename)

  return SPREADSHEET_MIME_TYPES.has(mimeType) || extension === "csv" || extension === "xls" || extension === "xlsx"
}

function isRFQSupportedAttachment(att: EmailAttachment) {
  return (
    att.mimeType === "application/pdf" ||
    ["image/jpeg", "image/png", "image/webp"].includes(att.mimeType) ||
    isSpreadsheetAttachment(att)
  )
}

function isPreviewableAttachment(att: EmailAttachment) {
  return (
    att.mimeType === "application/pdf" ||
    ["image/gif", "image/jpeg", "image/png", "image/webp"].includes(att.mimeType) ||
    isSpreadsheetAttachment(att)
  )
}

function buildAttachmentUrl(emailId: string, attachmentId: string, download = false) {
  const path = `${API_BASE}/${emailId}/attachments/${encodeURIComponent(attachmentId)}`
  return download ? `${path}/download` : path
}

function stringifySpreadsheetCell(cell: unknown) {
  if (cell == null) return ""
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10)
  return String(cell).replace(/\s+/g, " ").trim()
}

function getSpreadsheetRows(workbook: XLSX.WorkBook | null, sheetName: string) {
  if (!workbook) return []

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  })

  return rows
    .map((row) => row.slice(0, SPREADSHEET_PREVIEW_COLUMN_LIMIT).map(stringifySpreadsheetCell))
    .filter((row) => row.some(Boolean))
    .slice(0, SPREADSHEET_PREVIEW_ROW_LIMIT)
}

function SpreadsheetAttachmentPreview({
  emailId,
  attachment,
}: {
  emailId: string
  attachment: EmailAttachment
}) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [selectedSheet, setSelectedSheet] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSpreadsheet() {
      setLoading(true)
      setError(null)
      setWorkbook(null)
      setSelectedSheet("")

      try {
        const response = await fetch(buildAttachmentUrl(emailId, attachment.attachmentId), {
          credentials: "include",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const buffer = await response.arrayBuffer()
        const parsed = XLSX.read(buffer, { type: "array", cellDates: true })
        const firstSheet = parsed.SheetNames.find((sheetName) => parsed.Sheets[sheetName])
        if (!firstSheet) throw new Error("No worksheet found")

        if (!controller.signal.aborted) {
          setWorkbook(parsed)
          setSelectedSheet(firstSheet)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to preview spreadsheet")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadSpreadsheet()

    return () => controller.abort()
  }, [attachment.attachmentId, emailId])

  const sheetNames = workbook?.SheetNames.filter((sheetName) => workbook.Sheets[sheetName]) ?? []
  const rows = useMemo(() => getSpreadsheetRows(workbook, selectedSheet), [workbook, selectedSheet])
  const headerRow = rows[0] ?? []
  const dataRows = rows.slice(1)

  if (loading) {
    return (
      <div className="flex size-full flex-col gap-3 p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="surface-raised rounded-2xl p-5">
          <AlertCircleIcon className="size-8 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">Preview failed</p>
          <p className="max-w-sm text-[12px] text-muted-foreground">
            The spreadsheet could not be shown inline. You can still download the original file.
          </p>
          <p className="text-[11px] text-muted-foreground/60">{error}</p>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="surface-raised rounded-2xl p-5">
          <PaperclipIcon className="size-8 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">No rows to preview</p>
          <p className="max-w-sm text-[12px] text-muted-foreground">
            This spreadsheet does not contain visible rows in the selected sheet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col overflow-hidden bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div>
          <p className="text-[12px] font-semibold">Spreadsheet Preview</p>
          <p className="text-[11px] text-muted-foreground">
            Showing up to {SPREADSHEET_PREVIEW_ROW_LIMIT} rows and {SPREADSHEET_PREVIEW_COLUMN_LIMIT} columns.
          </p>
        </div>
        {sheetNames.length > 1 && (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            Sheet
            <select
              value={selectedSheet}
              onChange={(event) => setSelectedSheet(event.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-ring/40"
            >
              {sheetNames.map((sheetName) => (
                <option key={sheetName} value={sheetName}>
                  {sheetName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead>
            <tr>
              {headerRow.map((cell, index) => (
                <th
                  key={`${index}-${cell}`}
                  className="sticky top-0 z-10 border-b border-r border-border/60 bg-muted px-3 py-2 font-semibold text-foreground"
                >
                  {cell || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-muted/20">
                {headerRow.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="max-w-[280px] border-b border-r border-border/40 px-3 py-2 align-top text-muted-foreground"
                    title={row[columnIndex] ?? ""}
                  >
                    <span className="line-clamp-3 wrap-break-word">{row[columnIndex] ?? ""}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center animate-in fade-in-0 duration-500">
      <div className="surface-raised rounded-2xl p-6">
        <InboxIcon className="size-10 text-muted-foreground/40" />
      </div>
      <div className="space-y-1.5">
        <p className="font-heading text-[13px] font-semibold text-muted-foreground">No Emails Yet</p>
        <p className="text-[11px] text-muted-foreground/60">
          Incoming emails will appear here once the Gmail watcher picks them up.
        </p>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8 animate-in fade-in-0 duration-300">
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </div>
  )
}

function DetailPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="surface-raised rounded-2xl p-6">
        <MailOpenIcon className="size-8 text-muted-foreground/30" />
      </div>
      <div className="space-y-1">
        <p className="text-[13px] text-muted-foreground/50">Select an email to read</p>
        <p className="text-[11px] text-muted-foreground/30">Use J/K keys to navigate the list</p>
      </div>
    </div>
  )
}

export function EmailsPage() {
  const navigate = useNavigate()
  const { email: selectedEmailId } = useSearch({ from: "/emails" })
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "btsa:layout:inbox",
    storage: localStorage,
  })

  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(selectedEmailId ?? null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState<EmailDetail["attachments"][number] | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const emailDocument = useMemo(
    () => (detail?.bodyHtml ? buildEmailDocument(detail.bodyHtml) : null),
    [detail?.bodyHtml]
  )

  const fetchList = useCallback(async (p: number) => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch(`${API_BASE}?page=${p}&limit=20`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ListResponse = await res.json()
      setEmails(data.emails)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (err: any) {
      setListError(err.message || "Failed to load emails")
    } finally {
      setListLoading(false)
    }
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`${API_BASE}/${id}`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: EmailDetail = await res.json()
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const selectEmail = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (!id) {
        setDetail(null)
      }
      void navigate({
        to: "/emails",
        search: id ? { email: id } : {},
        replace: true,
      })
    },
    [navigate],
  )

  const openRFQ = useCallback(
    (rfqId: string) => {
      void navigate({
        to: "/rfq",
        search: { rfq: rfqId },
      })
    },
    [navigate],
  )

  useEffect(() => { fetchList(1) }, [fetchList])

  useEffect(() => {
    const nextSelectedId = selectedEmailId ?? null
    setSelectedId((current) => (current === nextSelectedId ? current : nextSelectedId))
    if (!nextSelectedId) {
      setDetail(null)
    }
  }, [selectedEmailId])

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId)
  }, [selectedId, fetchDetail])

  useEffect(() => {
    setSelectedAttachment(null)
  }, [selectedId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchList(page)
    setRefreshing(false)
  }

  const markEmailProcessing = (id: string) => {
    const nextState = {
      status: "processing" as const,
      rfqErrorMessage: null,
      classificationReason: null,
      isRFQ: null,
    }

    setEmails((current) =>
      current.map((email) => (email._id === id ? { ...email, ...nextState } : email))
    )
    setDetail((current) =>
      current?._id === id ? { ...current, ...nextState } : current
    )
  }

  const handleReprocessEmail = async (id: string) => {
    setReprocessingId(id)
    try {
      const res = await fetch(`${API_BASE}/${id}/reprocess`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      markEmailProcessing(id)
      toast.success("RFQ reprocessing started")
      await Promise.all([fetchList(page), fetchDetail(id)])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess RFQ")
    } finally {
      setReprocessingId(null)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === "j" || e.key === "k") {
        e.preventDefault()
        const currentIndex = emails.findIndex((em) => em._id === selectedId)
        const next = e.key === "j" ? currentIndex + 1 : currentIndex - 1
        if (next >= 0 && next < emails.length) {
          selectEmail(emails[next]._id)
        }
      }

      if (e.key === "Escape") {
        if (selectedAttachment) {
          setSelectedAttachment(null)
        } else if (detail) {
          selectEmail(null)
        }
      }

      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleRefresh()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [emails, selectedId, selectedAttachment, detail, page, selectEmail])

  const senderInitial = (from: string) => {
    const { name } = parseSender(from)
    return name.charAt(0).toUpperCase()
  }
  const canReprocessDetail = Boolean(
    detail && (detail.status === "failed" || detail.rfqErrorMessage)
  )
  const canOpenDetailRFQ = Boolean(detail?.isRFQ === true && detail.rfqId)

  return (
    <AppLayout>
        <SiteHeader />
        <ResizablePanelGroup orientation="horizontal" className="flex-1" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          {/* ── Email List Panel ── */}
          <ResizablePanel id="list" defaultSize="28%" minSize="18%" maxSize="45%" className="flex flex-col overflow-hidden bg-surface">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <InboxIcon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Inbox</h2>
                {!listLoading && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                    {total}
                  </span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh (R)</TooltipContent>
              </Tooltip>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto">
              {listLoading ? (
                <ListSkeleton />
              ) : listError ? (
                <ErrorState message={listError} onRetry={() => fetchList(page)} />
              ) : emails.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-0.5 px-2 pb-2 animate-in fade-in-0 duration-300">
                  {emails.map((email) => {
                    const { name, email: senderEmail } = parseSender(email.from)
                    const isSelected = selectedId === email._id
                    const colors = getAvatarColor(name)
                    return (
                      <div
                        key={email._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectEmail(email._id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            selectEmail(email._id)
                          }
                        }}
                        className={`group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ${
                          isSelected
                            ? "surface-raised glow-primary"
                            : "hover:bg-card/80 dark:hover:bg-card/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div
                              className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${colors.bg} ${colors.text}`}
                            >
                              {senderInitial(email.from)}
                            </div>
                            <SenderHoverCard name={name} email={senderEmail} side="right">
                              <span className="truncate text-[13px] font-medium hover:underline decoration-muted-foreground/30 underline-offset-2 cursor-pointer">
                                {name}
                              </span>
                            </SenderHoverCard>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                                {formatListTimestamp(email.date)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">{formatFullDateTime(email.date)}</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-start justify-between gap-2 pl-[38px]">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] leading-snug text-foreground/80">
                              {email.subject || "(no subject)"}
                            </p>
                            {email.snippet && (
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/60">
                                {email.snippet}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            {email.attachments.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PaperclipIcon className="size-3 text-muted-foreground/40" />
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 pl-[38px]">
                          <StatusBadge status={email.status} />
                          <ClassificationBadge email={email} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => fetchList(page - 1)}>
                        <ChevronLeftIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous page</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => fetchList(page + 1)}>
                        <ChevronRightIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next page</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle />

          {/* ── Email Detail Panel ── */}
          <ResizablePanel id="detail" defaultSize="72%" minSize="40%" className="hidden flex-col overflow-hidden md:flex">
            {detailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <DetailPlaceholder />
            ) : (
              <div className="animate-in fade-in-0 duration-300 flex flex-1 flex-col overflow-hidden">
                <div className="shrink-0 space-y-4 px-8 pt-7 pb-6">
                  <div className="flex items-start justify-between gap-4">
                    <h1 className="font-heading text-lg font-semibold leading-snug tracking-tight">
                      {detail.subject || "(no subject)"}
                    </h1>
                    <div className="flex shrink-0 items-center gap-1">
                      {canReprocessDetail && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground/50 hover:text-foreground"
                              onClick={() => handleReprocessEmail(detail._id)}
                              disabled={reprocessingId === detail._id}
                            >
                              <RefreshCwIcon className={`size-4 ${reprocessingId === detail._id ? "animate-spin" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reprocess RFQ</TooltipContent>
                        </Tooltip>
                      )}
                      {canOpenDetailRFQ && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground/50 hover:text-foreground"
                              onClick={() => openRFQ(detail.rfqId!)}
                            >
                              <FileTextIcon className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open related RFQ</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/50 hover:text-foreground"
                            asChild
                          >
                            <a href={buildGmailUrl(detail)} target="_blank" rel="noreferrer">
                              <ExternalLinkIcon className="size-4" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in Gmail</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => openDownload(`${API_BASE}/${detail._id}/pdf`)}
                          >
                            <DownloadIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download PDF</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => selectEmail(null)}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Close (Esc)</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(() => {
                      const { name, email: senderEmail } = parseSender(detail.from)
                      const colors = getAvatarColor(name)
                      return (
                        <>
                          <div className={`flex size-9 items-center justify-center rounded-lg text-[13px] font-semibold ${colors.bg} ${colors.text}`}>
                            {senderInitial(detail.from)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <SenderHoverCard name={name} email={senderEmail} side="bottom">
                                <span className="text-[13px] font-semibold hover:underline decoration-muted-foreground/30 underline-offset-2 cursor-pointer">
                                  {name}
                                </span>
                              </SenderHoverCard>
                              <StatusBadge status={detail.status} />
                            </div>
                            <CopyableText value={senderEmail} label="Email copied">
                              <p className="truncate text-[11px] text-muted-foreground/60">
                                {senderEmail}
                              </p>
                            </CopyableText>
                          </div>
                        </>
                      )
                    })()}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/60">
                          <ClockIcon className="size-3" />
                          {formatFullDateTime(detail.date)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{new Date(detail.date).toISOString()}</TooltipContent>
                    </Tooltip>
                  </div>

                  <RecipientsBar to={detail.to} cc={detail.cc} />

                  {detail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detail.attachments.map((att, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="surface-inset inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
                              onClick={() => setSelectedAttachment(att)}
                            >
                              <PaperclipIcon className="size-3" />
                              {att.filename}
                              <span className="text-[10px] opacity-50">
                                ({(att.size / 1024).toFixed(0)}KB)
                              </span>
                              {isRFQSupportedAttachment(att) && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                                  RFQ scan
                                </span>
                              )}
                              {isPreviewableAttachment(att) ? (
                                <EyeIcon className="size-3 opacity-60" />
                              ) : (
                                <ExternalLinkIcon className="size-3 opacity-60" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Click to preview {att.mimeType.split("/")[1]?.toUpperCase()}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}

                  {(detail.classificationReason || detail.rfqErrorMessage || detail.isRFQ !== null) && (
                    <div className="surface-inset rounded-xl border border-border/40 p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <ClassificationBadge email={detail} />
                        <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          Classification
                        </span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        {detail.rfqErrorMessage || detail.classificationReason || "RFQ classification is pending."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-hidden border-t border-border/30">
                  {emailDocument ? (
                    <iframe
                      title="Email content"
                      className="size-full border-0 bg-white"
                      sandbox="allow-same-origin"
                      srcDoc={emailDocument}
                    />
                  ) : detail.bodyText ? (
                    <div className="h-full overflow-y-auto p-8">
                      <pre className="whitespace-pre-wrap font-[Arial,sans-serif] text-[13px] leading-normal text-foreground/85">
                        {detail.bodyText}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-12 text-[13px] text-muted-foreground/50">
                      No content available
                    </div>
                  )}
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
        {detail && selectedAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm animate-in fade-in-0 duration-200">
            <div className="flex h-full max-h-[860px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{selectedAttachment.filename}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedAttachment.mimeType || "Unknown type"} · {(selectedAttachment.size / 1024).toFixed(0)}KB
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={buildAttachmentUrl(detail._id, selectedAttachment.attachmentId, true)}>
                      <DownloadIcon className="mr-1.5 size-3.5" />
                      Download
                    </a>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedAttachment(null)}>
                        <XIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close (Esc)</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30">
                {selectedAttachment.mimeType === "application/pdf" ? (
                  <iframe
                    title={selectedAttachment.filename}
                    className="size-full border-0 bg-white"
                    src={buildAttachmentUrl(detail._id, selectedAttachment.attachmentId)}
                  />
                ) : selectedAttachment.mimeType.startsWith("image/") && isPreviewableAttachment(selectedAttachment) ? (
                  <div className="size-full overflow-auto p-6 text-center">
                    <img
                      src={buildAttachmentUrl(detail._id, selectedAttachment.attachmentId)}
                      alt={selectedAttachment.filename}
                      className="mx-auto max-h-full max-w-full rounded-lg object-contain shadow-lg"
                    />
                  </div>
                ) : isSpreadsheetAttachment(selectedAttachment) ? (
                  <SpreadsheetAttachmentPreview emailId={detail._id} attachment={selectedAttachment} />
                ) : (
                  <div className="flex flex-col items-center gap-4 p-10 text-center">
                    <div className="surface-raised rounded-2xl p-5">
                      <PaperclipIcon className="size-8 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[13px] font-semibold">Preview not available</p>
                      <p className="max-w-sm text-[12px] text-muted-foreground">
                        This attachment type is available to download, but it is not shown inline for safety.
                      </p>
                    </div>
                    <Button asChild>
                      <a href={buildAttachmentUrl(detail._id, selectedAttachment.attachmentId, true)}>
                        <DownloadIcon className="mr-2 size-4" />
                        Download Attachment
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </AppLayout>
  )
}

export default EmailsPage
