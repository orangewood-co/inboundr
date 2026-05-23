import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDefaultLayout } from "react-resizable-panels"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SenderHoverCard } from "@/components/contact-hover-card"
import { CopyableText } from "@/components/copy-button"
import { getAvatarColor } from "@/lib/utils"
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
} from "lucide-react"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/email`

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

function buildGmailUrl(email: Pick<EmailSummary, "threadId" | "messageId" | "gmailAccountEmail">): string {
  const gmailId = email.threadId || email.messageId
  const authUser = email.gmailAccountEmail ? `?authuser=${encodeURIComponent(email.gmailAccountEmail)}` : ""
  return `https://mail.google.com/mail/${authUser}#inbox/${encodeURIComponent(gmailId)}`
}

const statusConfig = {
  received: {
    label: "Received",
    description: "Email received and queued for processing",
    dotClass: "bg-blue-500",
    pillClass: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  },
  processing: {
    label: "Processing",
    description: "AI is classifying this email",
    dotClass: "bg-amber-500 animate-pulse",
    pillClass: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
  processed: {
    label: "Processed",
    description: "Classification complete",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  failed: {
    label: "Failed",
    description: "Processing failed — check error details",
    dotClass: "bg-red-500",
    pillClass: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
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
          <span className="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/20 dark:text-red-400">
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
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
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
        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          Pending
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Waiting for classification</TooltipContent>
    </Tooltip>
  )
}

function isRFQSupportedAttachment(att: EmailSummary["attachments"][number]) {
  return att.mimeType === "application/pdf" || ["image/jpeg", "image/png", "image/webp"].includes(att.mimeType)
}

function isPreviewableAttachment(att: EmailSummary["attachments"][number]) {
  return att.mimeType === "application/pdf" || ["image/gif", "image/jpeg", "image/png", "image/webp"].includes(att.mimeType)
}

function buildAttachmentUrl(emailId: string, attachmentId: string, download = false) {
  const path = `${API_BASE}/${emailId}/attachments/${encodeURIComponent(attachmentId)}`
  return download ? `${path}/download` : path
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center animate-in fade-in-0 duration-500">
      <div className="surface-raised rounded-2xl p-6">
        <InboxIcon className="size-10 text-muted-foreground/40" />
      </div>
      <div className="space-y-1.5">
        <p className="font-heading text-[13px] font-semibold text-muted-foreground">No emails yet</p>
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

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState<EmailDetail["attachments"][number] | null>(null)

  const [refreshing, setRefreshing] = useState(false)
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

  useEffect(() => { fetchList(1) }, [fetchList])

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

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === "j" || e.key === "k") {
        e.preventDefault()
        const currentIndex = emails.findIndex((em) => em._id === selectedId)
        const next = e.key === "j" ? currentIndex + 1 : currentIndex - 1
        if (next >= 0 && next < emails.length) {
          setSelectedId(emails[next]._id)
        }
      }

      if (e.key === "Escape") {
        if (selectedAttachment) {
          setSelectedAttachment(null)
        } else if (detail) {
          setSelectedId(null)
          setDetail(null)
        }
      }

      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleRefresh()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [emails, selectedId, selectedAttachment, detail, page])

  const senderInitial = (from: string) => {
    const { name } = parseSender(from)
    return name.charAt(0).toUpperCase()
  }

  return (
    <AppLayout>
        <SiteHeader />
        <ResizablePanelGroup orientation="horizontal" className="flex-1" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          {/* ── Email List Panel ── */}
          <ResizablePanel id="list" defaultSize="28%" minSize="18%" maxSize="45%" className="flex flex-col overflow-hidden bg-surface">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Inbox</h2>
                {!listLoading && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary dark:bg-primary/20">
                    {total}
                  </span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCwIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh (R)</TooltipContent>
              </Tooltip>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto">
              {listLoading ? (
                <ListSkeleton />
              ) : listError ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <AlertCircleIcon className="size-5 text-destructive" />
                  <p className="text-[13px] text-destructive">{listError}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchList(page)}>
                    Retry
                  </Button>
                </div>
              ) : emails.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-0.5 px-2 pb-2 animate-in fade-in-0 duration-300">
                  {emails.map((email) => {
                    const { name, email: senderEmail } = parseSender(email.from)
                    const isSelected = selectedId === email._id
                    const colors = getAvatarColor(name)
                    return (
                      <button
                        key={email._id}
                        onClick={() => setSelectedId(email._id)}
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
                                {formatDate(email.date)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">{formatFullDate(email.date)}</TooltipContent>
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
                      </button>
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
                <div className="space-y-4 px-8 pt-7 pb-6">
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
                            onClick={() => {
                              setSelectedId(null)
                              setDetail(null)
                            }}
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
                          {formatFullDate(detail.date)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{new Date(detail.date).toISOString()}</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/60">
                    <span>
                      <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">To</span>{" "}
                      <CopyableText value={detail.to} label="Recipient copied">
                        {detail.to}
                      </CopyableText>
                    </span>
                    {detail.cc && (
                      <span>
                        <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cc</span>{" "}
                        <CopyableText value={detail.cc} label="CC copied">
                          {detail.cc}
                        </CopyableText>
                      </span>
                    )}
                  </div>

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

                <div className="flex-1 overflow-hidden border-t border-border/30">
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
                        Download attachment
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
