import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  InboxIcon,
  MailIcon,
  MailOpenIcon,
  PaperclipIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  LoaderIcon,
} from "lucide-react"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/email`

interface EmailSummary {
  _id: string
  messageId: string
  from: string
  to: string
  subject: string
  snippet: string | null
  date: string
  status: "received" | "processing" | "processed" | "failed"
  labels: string[]
  attachments: { filename: string; mimeType: string; size: number }[]
}

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
      padding: 16px;
      color: #1a1a1a;
      overflow-wrap: anywhere;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    pre {
      white-space: pre-wrap;
      overflow-x: auto;
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"

  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const statusConfig = {
  received: { icon: MailIcon, label: "Received", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  processing: { icon: LoaderIcon, label: "Processing", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  processed: { icon: CheckCircle2Icon, label: "Processed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  failed: { icon: AlertCircleIcon, label: "Failed", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
}

function StatusBadge({ status }: { status: EmailSummary["status"] }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}>
      <Icon className={`size-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-6">
        <InboxIcon className="size-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No emails yet</p>
        <p className="text-xs text-muted-foreground/60">
          Incoming emails will appear here once the Gmail watcher picks them up.
        </p>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-0.5 p-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg p-3">
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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <Skeleton className="h-px w-full" />
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="rounded-xl bg-muted/40 p-4">
        <MailOpenIcon className="size-8 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">Select an email to read</p>
    </div>
  )
}

export function EmailsPage() {
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
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

  useEffect(() => { fetchList(1) }, [fetchList])

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId)
  }, [selectedId, fetchDetail])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchList(page)
    setRefreshing(false)
  }

  const senderInitial = (from: string) => {
    const { name } = parseSender(from)
    return name.charAt(0).toUpperCase()
  }

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--header-height": "4rem",
          "--sidebar-width": "18rem",
        } as CSSProperties
      }
    >
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex flex-1 overflow-hidden">
          {/* ── Email List Panel ── */}
          <div className="flex w-full flex-col border-r md:w-[380px] md:min-w-[380px]">
            {/* List header */}
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
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* List body */}
            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <ListSkeleton />
              ) : listError ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <AlertCircleIcon className="size-5 text-destructive" />
                  <p className="text-sm text-destructive">{listError}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchList(page)}>
                    Retry
                  </Button>
                </div>
              ) : emails.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-0.5 p-1">
                  {emails.map((email) => {
                    const { name } = parseSender(email.from)
                    const isSelected = selectedId === email._id
                    return (
                      <button
                        key={email._id}
                        onClick={() => setSelectedId(email._id)}
                        className={`group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/8 ring-1 ring-primary/20"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {senderInitial(email.from)}
                            </div>
                            <span className="truncate text-sm font-semibold">{name}</span>
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatDate(email.date)}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2 pl-[42px]">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-snug">
                              {email.subject || "(no subject)"}
                            </p>
                            {email.snippet && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                {email.snippet}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            {email.attachments.length > 0 && (
                              <PaperclipIcon className="size-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="pl-[42px]">
                          <StatusBadge status={email.status} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => fetchList(page - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page >= totalPages}
                    onClick={() => fetchList(page + 1)}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Email Detail Panel ── */}
          <div className="hidden flex-1 flex-col overflow-hidden md:flex">
            {detailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <DetailPlaceholder />
            ) : (
              <>
                {/* Detail header */}
                <div className="space-y-4 border-b px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <h1 className="text-lg font-semibold leading-snug">
                      {detail.subject || "(no subject)"}
                    </h1>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => {
                        setSelectedId(null)
                        setDetail(null)
                      }}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {senderInitial(detail.from)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {parseSender(detail.from).name}
                        </span>
                        <StatusBadge status={detail.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {parseSender(detail.from).email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="size-3" />
                      {formatFullDate(detail.date)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground/70">To:</span>{" "}
                      {detail.to}
                    </span>
                    {detail.cc && (
                      <span>
                        <span className="font-medium text-foreground/70">Cc:</span>{" "}
                        {detail.cc}
                      </span>
                    )}
                  </div>

                  {detail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detail.attachments.map((att, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <PaperclipIcon className="size-3" />
                          {att.filename}
                          <span className="text-[10px] opacity-60">
                            ({(att.size / 1024).toFixed(0)}KB)
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email body */}
                <div className="flex-1 overflow-hidden">
                  {emailDocument ? (
                    <iframe
                      title="Email content"
                      className="size-full border-0 bg-white"
                      sandbox="allow-same-origin"
                      srcDoc={emailDocument}
                    />
                  ) : detail.bodyText ? (
                    <div className="h-full overflow-y-auto p-6">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                        {detail.bodyText}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                      No content available
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default EmailsPage
