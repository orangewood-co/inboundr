import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import * as XLSX from "xlsx"
import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDefaultLayout } from "react-resizable-panels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  ReplyIcon,
  ReplyAllIcon,
  ForwardIcon,
  SearchIcon,
} from "lucide-react"

import { ReplyComposer } from "@/components/email/reply-composer"
import { ThreadStack } from "@/components/email/thread-stack"
import {
  createDraft,
  fetchThread,
  syncThread,
  type ReplyKind,
  type ThreadMessage,
} from "@/lib/email-reply"

import { API_ORIGIN } from "@/lib/env"
import { gmailAccountsQueryOptions } from "@/lib/queries"
import { queryClient } from "@/lib/query-client"
const API_BASE = `${API_ORIGIN}/api/v1/email`
const SPREADSHEET_PREVIEW_ROW_LIMIT = 200
const SPREADSHEET_PREVIEW_COLUMN_LIMIT = 30
const SEARCH_DEBOUNCE_MS = 300

/** Classification filters the list endpoint understands; absent means all. */
export const EMAIL_LIST_FILTERS = ["rfq", "not_rfq", "pending", "failed"] as const
export type EmailListFilter = (typeof EMAIL_LIST_FILTERS)[number]

type InboxChip = "all" | "rfq" | "failed"

interface InboxListParams {
  q?: string
  filter?: EmailListFilter
}

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
  threadCount?: number
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
  rfqCount: number
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

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center animate-in fade-in-0 duration-500">
      <div className="surface-raised rounded-2xl p-6">
        {filtered ? (
          <SearchIcon className="size-10 text-muted-foreground/40" />
        ) : (
          <InboxIcon className="size-10 text-muted-foreground/40" />
        )}
      </div>
      <div className="space-y-1.5">
        <p className="font-heading text-[13px] font-semibold text-muted-foreground">
          {filtered ? "No Emails Match" : "No Emails Yet"}
        </p>
        <p className="text-[11px] text-muted-foreground/60">
          {filtered
            ? "Try a different search term or clear the active filters."
            : "Incoming emails will appear here once the Gmail watcher picks them up."}
        </p>
      </div>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear Filters
        </Button>
      )}
    </div>
  )
}

const INBOX_CHIPS: { value: InboxChip; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rfq", label: "RFQ" },
  { value: "failed", label: "Failed" },
]

function chipFromParams(params: InboxListParams): InboxChip {
  if (params.filter === "rfq" || params.filter === "failed") return params.filter
  return "all"
}

function paramsFromChip(chip: InboxChip): Pick<InboxListParams, "filter"> {
  return { filter: chip === "all" ? undefined : chip }
}

function InboxChips({
  active,
  counts,
  onChange,
}: {
  active: InboxChip
  counts: Partial<Record<InboxChip, number>>
  onChange: (chip: InboxChip) => void
}) {
  return (
    <div role="tablist" aria-label="Filter conversations" className="flex items-center gap-1 overflow-x-auto">
      {INBOX_CHIPS.map((chip) => {
        const isActive = chip.value === active
        const count = counts[chip.value]
        return (
          <button
            key={chip.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(chip.value)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {chip.label}
            {count != null && count > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                  isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
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
        <p className="text-[11px] text-muted-foreground/30">J/K to navigate · / to search</p>
      </div>
    </div>
  )
}

export function EmailsPage() {
  const navigate = useNavigate()
  const {
    email: selectedEmailId,
    q: listQuery,
    filter: listFilter,
  } = useSearch({ from: "/emails" })
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "inboundr:layout:inbox",
    storage: localStorage,
  })

  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [chipCounts, setChipCounts] = useState<Partial<Record<InboxChip, number>>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // The input is controlled locally and pushed to the URL after a pause, so
  // typing does not fire a request per keystroke.
  const [searchInput, setSearchInput] = useState(listQuery ?? "")
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Last query this component wrote to the URL, so the URL→input sync below
  // can tell its own writes apart from external navigation.
  const pushedQueryRef = useRef(listQuery ?? "")
  const activeChip = chipFromParams({ filter: listFilter })
  const hasActiveFilters = Boolean(listQuery || listFilter)

  const [selectedId, setSelectedId] = useState<string | null>(selectedEmailId ?? null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState<EmailDetail["attachments"][number] | null>(null)
  // Attachments can belong to any message in the thread, not just the selected one.
  const [attachmentOwnerId, setAttachmentOwnerId] = useState<string | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [threadDrafts, setThreadDrafts] = useState<ThreadMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [signaturesByAccount, setSignaturesByAccount] = useState<Record<string, string | null>>({})

  const fetchList = useCallback(
    async (p: number) => {
      setListLoading(true)
      setListError(null)
      try {
        const params = new URLSearchParams({ page: String(p), limit: "20" })
        if (listQuery) params.set("q", listQuery)
        if (listFilter) params.set("filter", listFilter)
        const res = await fetch(`${API_BASE}?${params}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ListResponse = await res.json()
        setEmails(data.emails)
        setTotal(data.total)
        setChipCounts({ rfq: data.rfqCount })
        setPage(data.page)
        setTotalPages(data.totalPages)
      } catch (err: any) {
        setListError(err.message || "Failed to load emails")
      } finally {
        setListLoading(false)
      }
    },
    [listQuery, listFilter]
  )

  /** Merge into the URL so the list state survives refresh and is shareable. */
  const updateListParams = useCallback(
    (patch: InboxListParams) => {
      void navigate({
        to: "/emails",
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
      })
    },
    [navigate]
  )

  const setChip = useCallback(
    (chip: InboxChip) => updateListParams(paramsFromChip(chip)),
    [updateListParams]
  )

  const clearFilters = useCallback(() => {
    setSearchInput("")
    pushedQueryRef.current = ""
    updateListParams({ q: undefined, filter: undefined })
  }, [updateListParams])

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === (listQuery ?? "")) return
    const timeout = window.setTimeout(() => {
      pushedQueryRef.current = trimmed
      updateListParams({ q: trimmed || undefined })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [searchInput, listQuery, updateListParams])

  // Back/forward or a shared link can change the query out from under the
  // input. Writes that originated here are skipped so in-flight keystrokes
  // are never overwritten by the echo of an older value.
  useEffect(() => {
    const next = listQuery ?? ""
    if (next === pushedQueryRef.current) return
    pushedQueryRef.current = next
    setSearchInput(next)
  }, [listQuery])

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
        search: (prev) => ({ ...prev, email: id ?? undefined }),
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

  const previewAttachment = useCallback(
    (emailId: string, attachment: EmailAttachment) => {
      setAttachmentOwnerId(emailId)
      setSelectedAttachment(attachment)
    },
    []
  )

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true)
    setThreadError(null)
    try {
      const initial = await fetchThread(id)
      setThreadMessages(initial.messages)
      setThreadDrafts(initial.drafts)
      setThreadLoading(false)

      // Backfill anything Gmail has that we never ingested, such as messages
      // sent straight from Gmail. Failures here leave the rendered thread alone.
      try {
        const synced = await syncThread(id)
        setThreadMessages(synced.messages)
        setThreadDrafts(synced.drafts)
      } catch (err) {
        console.error("Thread sync failed:", err)
        toast.error(
          err instanceof Error
            ? `Could not check Gmail for newer messages: ${err.message}`
            : "Could not check Gmail for newer messages"
        )
      }
    } catch (err) {
      setThreadMessages([])
      setThreadDrafts([])
      setThreadLoading(false)
      setThreadError(err instanceof Error ? err.message : "Failed to load the conversation")
    }
  }, [])

  useEffect(() => { fetchList(1) }, [fetchList])

  useEffect(() => {
    let cancelled = false

    async function loadSignatures() {
      try {
        const data = (await queryClient.fetchQuery(gmailAccountsQueryOptions)) as {
          accounts?: { emailAddress: string; signatureHtml: string | null }[]
        }
        if (cancelled) return
        setSignaturesByAccount(
          Object.fromEntries(
            (data.accounts ?? []).map((account) => [
              account.emailAddress.toLowerCase(),
              account.signatureHtml ?? null,
            ])
          )
        )
      } catch {
        // A missing signature is not worth surfacing.
      }
    }

    void loadSignatures()
    return () => {
      cancelled = true
    }
  }, [])

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
    setAttachmentOwnerId(null)
    setActiveDraftId(null)
    setThreadMessages([])
    setThreadDrafts([])
    setThreadError(null)
    if (selectedId) void loadThread(selectedId)
  }, [selectedId, loadThread])

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

  const activeDraft = useMemo(
    () => threadDrafts.find((draft) => draft._id === activeDraftId) ?? null,
    [threadDrafts, activeDraftId]
  )

  // A reply anchors to the newest message in the thread, matching Gmail, and
  // falls back to the selected email until the thread has loaded. Anchoring on
  // one of our own sent messages is safe: the server derives recipients from who
  // that message was addressed to rather than from its sender.
  const composeParent = useMemo<ThreadMessage | null>(() => {
    if (threadMessages.length > 0) return threadMessages[threadMessages.length - 1]
    return detail ? (detail as unknown as ThreadMessage) : null
  }, [threadMessages, detail])

  // The detail fallback is not serialized through the thread endpoint, so it
  // carries no canReplyAll; offering the control is better than hiding it before
  // the thread arrives.
  const canReplyAll = composeParent?.canReplyAll ?? true

  const startCompose = useCallback(
    async (requested: ReplyKind) => {
      if (!composeParent || creatingDraft) return

      // With nobody extra to copy, reply-all is just a reply. The shortcut stays
      // useful rather than doing nothing while its button is hidden.
      const kind = requested === "reply_all" && !canReplyAll ? "reply" : requested

      // Reuse an open draft of the same kind rather than stacking duplicates.
      const existing = threadDrafts.find((draft) => draft.kind === kind)
      if (existing) {
        setActiveDraftId(existing._id)
        return
      }

      setCreatingDraft(true)
      try {
        const draft = await createDraft(composeParent._id, kind)
        setThreadDrafts((current) => [...current, draft])
        setActiveDraftId(draft._id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start a reply")
      } finally {
        setCreatingDraft(false)
      }
    },
    [composeParent, creatingDraft, threadDrafts, canReplyAll]
  )

  const handleDraftSaved = useCallback((saved: ThreadMessage) => {
    setThreadDrafts((current) =>
      current.map((draft) => (draft._id === saved._id ? saved : draft))
    )
  }, [])

  const handleDraftSent = useCallback((sent: ThreadMessage) => {
    setThreadDrafts((current) => current.filter((draft) => draft._id !== sent._id))
    // A forward opens its own conversation, so it does not belong in this thread.
    setThreadMessages((current) => {
      if (sent.kind === "forward") return current
      if (current.some((message) => message._id === sent._id)) return current
      return [...current, sent]
    })
    setActiveDraftId(null)
  }, [])

  const handleDraftDiscarded = useCallback((draftId: string) => {
    setThreadDrafts((current) => current.filter((draft) => draft._id !== draftId))
    setActiveDraftId(null)
  }, [])

  const parentSignature = composeParent
    ? signaturesByAccount[(detail?.gmailAccountEmail ?? "").toLowerCase()] ?? null
    : null

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      if (e.key === "Escape") {
        if (selectedAttachment) {
          setSelectedAttachment(null)
        } else if (activeDraftId) {
          setActiveDraftId(null)
        } else if (detail) {
          selectEmail(null)
        }
        return
      }

      // Everything below acts on the thread, which is behind an open overlay.
      if (activeDraftId || selectedAttachment) return

      if (e.key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (e.key === "j" || e.key === "k") {
        e.preventDefault()
        const currentIndex = emails.findIndex((em) => em._id === selectedId)
        const next = e.key === "j" ? currentIndex + 1 : currentIndex - 1
        if (next >= 0 && next < emails.length) {
          selectEmail(emails[next]._id)
        }
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Shift+R refreshes; plain r/a/f drive the composer, matching Gmail.
      if (e.key === "R" && e.shiftKey) {
        e.preventDefault()
        handleRefresh()
        return
      }

      if (e.shiftKey) return

      if (e.key === "r" && detail) {
        e.preventDefault()
        void startCompose("reply")
      }
      if (e.key === "a" && detail) {
        e.preventDefault()
        void startCompose("reply_all")
      }
      if (e.key === "f" && detail) {
        e.preventDefault()
        void startCompose("forward")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [emails, selectedId, selectedAttachment, detail, page, selectEmail, startCompose, activeDraftId])

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

            <div className="space-y-2 border-b px-3 py-2.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  ref={searchInputRef}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return
                    event.preventDefault()
                    if (searchInput) setSearchInput("")
                    else event.currentTarget.blur()
                  }}
                  placeholder="Search sender, subject, or preview"
                  aria-label="Search conversations"
                  className="h-8 pl-8 pr-8 text-[12px]"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("")
                      searchInputRef.current?.focus()
                    }}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </div>
              <InboxChips active={activeChip} counts={chipCounts} onChange={setChip} />
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto">
              {listLoading && emails.length === 0 ? (
                <ListSkeleton />
              ) : listError ? (
                <ErrorState message={listError} onRetry={() => fetchList(page)} />
              ) : emails.length === 0 ? (
                <EmptyState filtered={hasActiveFilters} onClear={clearFilters} />
              ) : (
                <div
                  className={`space-y-0.5 px-2 pb-2 animate-in fade-in-0 duration-300 transition-opacity ${
                    listLoading ? "pointer-events-none opacity-50" : ""
                  }`}
                  aria-busy={listLoading}
                >
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
                            {(email.threadCount ?? 1) > 1 && (
                              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                                {email.threadCount}
                              </span>
                            )}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => void startCompose("reply")}
                            disabled={creatingDraft}
                          >
                            <ReplyIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply (R)</TooltipContent>
                      </Tooltip>
                      {canReplyAll && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground/50 hover:text-foreground"
                              onClick={() => void startCompose("reply_all")}
                              disabled={creatingDraft}
                            >
                              <ReplyAllIcon className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reply All (A)</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => void startCompose("forward")}
                            disabled={creatingDraft}
                          >
                            <ForwardIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Forward (F)</TooltipContent>
                      </Tooltip>
                      <span className="mx-0.5 h-4 w-px bg-border/60" />
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
                              onClick={() => previewAttachment(detail._id, att)}
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

                <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/30">
                  {threadLoading && threadMessages.length === 0 ? (
                    <div className="space-y-2 px-8 py-4">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : threadError ? (
                    <div className="mx-8 my-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                      <p className="text-[13px] font-medium text-destructive">
                        This conversation could not be loaded
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {threadError}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => selectedId && void loadThread(selectedId)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <ThreadStack
                      messages={threadMessages}
                      failedDrafts={threadDrafts.filter(
                        (draft) => draft.sendStatus === "failed" && draft._id !== activeDraftId
                      )}
                      buildDocument={buildEmailDocument}
                      buildAttachmentUrl={buildAttachmentUrl}
                      isPreviewable={isPreviewableAttachment}
                      onPreview={(message, attachment) =>
                        previewAttachment(message._id, attachment)
                      }
                      onResumeDraft={(draft) => setActiveDraftId(draft._id)}
                    />
                  )}
                </div>

                {activeDraft && composeParent && (
                  <ReplyComposer
                    key={activeDraft._id}
                    draft={activeDraft}
                    parent={composeParent}
                    fromAddress={detail.gmailAccountEmail ?? null}
                    signatureHtml={parentSignature}
                    onSent={handleDraftSent}
                    onDiscarded={handleDraftDiscarded}
                    onDraftSaved={handleDraftSaved}
                    onClose={() => setActiveDraftId(null)}
                  />
                )}

                <div className="flex shrink-0 items-center gap-2 border-t border-border/40 px-8 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={creatingDraft}
                    onClick={() => void startCompose("reply")}
                  >
                    <ReplyIcon className="mr-1.5 size-3.5" />
                    Reply
                  </Button>
                  {canReplyAll && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creatingDraft}
                      onClick={() => void startCompose("reply_all")}
                    >
                      <ReplyAllIcon className="mr-1.5 size-3.5" />
                      Reply All
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={creatingDraft}
                    onClick={() => void startCompose("forward")}
                  >
                    <ForwardIcon className="mr-1.5 size-3.5" />
                    Forward
                  </Button>
                  {threadDrafts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveDraftId(threadDrafts[0]._id)}
                      className="ml-auto text-[11px] text-muted-foreground/70 underline decoration-dotted underline-offset-2 hover:text-foreground"
                    >
                      {threadDrafts.length === 1
                        ? "Resume saved draft"
                        : `${threadDrafts.length} saved drafts`}
                    </button>
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
                    <a href={buildAttachmentUrl(attachmentOwnerId ?? detail._id, selectedAttachment.attachmentId, true)}>
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
                    src={buildAttachmentUrl(attachmentOwnerId ?? detail._id, selectedAttachment.attachmentId)}
                  />
                ) : selectedAttachment.mimeType.startsWith("image/") && isPreviewableAttachment(selectedAttachment) ? (
                  <div className="size-full overflow-auto p-6 text-center">
                    <img
                      src={buildAttachmentUrl(attachmentOwnerId ?? detail._id, selectedAttachment.attachmentId)}
                      alt={selectedAttachment.filename}
                      className="mx-auto max-h-full max-w-full rounded-lg object-contain shadow-lg"
                    />
                  </div>
                ) : isSpreadsheetAttachment(selectedAttachment) ? (
                  <SpreadsheetAttachmentPreview emailId={attachmentOwnerId ?? detail._id} attachment={selectedAttachment} />
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
                      <a href={buildAttachmentUrl(attachmentOwnerId ?? detail._id, selectedAttachment.attachmentId, true)}>
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
