import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FileIcon,
  InboxIcon,
  LoaderIcon,
  PaperclipIcon,
  RefreshCcwIcon,
  SendIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { API_ORIGIN, getEmbedOrigin } from "@/lib/env"
import { getActiveOrganizationId, setActiveOrganizationId } from "@/lib/organization-context"
import { cn, copyToClipboard, getAvatarColor } from "@/lib/utils"

type TicketStatus = "open" | "pending" | "resolved" | "closed"
type TicketFilter = TicketStatus | "all"
type MessageAuthorType = "visitor" | "bot" | "agent" | "system"

type Ticket = {
  id: string
  ticketNumber: number
  subject: string
  status: TicketStatus
  priority: string
  channel: string
  requester: { name: string; email: string }
  botEnabled: boolean
  lastMessageAt: string
  lastVisitorMessageAt: string | null
  lastAgentMessageAt: string | null
  lastVisitorReadAt: string | null
  lastAgentReadAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

type TicketAttachment = {
  key: string
  originalName: string
  contentType: string
  size: number
  url: string | null
}

type TicketMessage = {
  id: string
  ticketId: string
  authorType: MessageAuthorType
  authorUserId: string | null
  bodyText: string
  attachments: TicketAttachment[]
  createdAt: string
  updatedAt: string
}

type SocketEvent =
  | { type: "connected" }
  | { type: "ticket.updated"; ticket: Ticket }
  | { type: "message.created"; message: TicketMessage }
  | { type: "typing"; ticketId: string; actor: "agent" | "visitor"; isTyping: boolean }
  | { type: "error"; error: string }
  | { type: "ticket.subscribed"; ticketId: string }
  | { type: "pong" }

type PendingAttachment = {
  id: string
  file: File
}

const TICKET_FILTERS: { value: TicketFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
]

function wsUrl() {
  const url = new URL(API_ORIGIN)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/api/v1/support/ws"
  url.search = ""
  url.searchParams.set("mode", "agent")
  const organizationId = getActiveOrganizationId()
  if (organizationId) url.searchParams.set("organizationId", organizationId)
  return url.toString()
}

function formatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatFullTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatRelativeTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return "now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d`
  const diffWeek = Math.round(diffDay / 7)
  if (diffWeek < 5) return `${diffWeek}w`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ticketMatchesFilter(ticket: Ticket, filter: TicketFilter) {
  return filter === "all" || ticket.status === filter
}

function isUnread(ticket: Ticket) {
  if (!ticket.lastVisitorMessageAt) return false
  if (!ticket.lastAgentReadAt) return true
  return new Date(ticket.lastVisitorMessageAt) > new Date(ticket.lastAgentReadAt)
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function SupportPage() {
  const [filter, setFilter] = useState<TicketFilter>("open")
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reply, setReply] = useState("")
  const [files, setFiles] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [socketReady, setSocketReady] = useState(false)
  const [visitorTyping, setVisitorTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState(() => getActiveOrganizationId() ?? "")
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const selectedTicketIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const apiBase = `${API_ORIGIN}/api/v1/tickets`
  const supportChatLink = useMemo(() => {
    return organizationId ? `${getEmbedOrigin()}/support/${organizationId}` : ""
  }, [organizationId])

  const unreadCount = useMemo(() => tickets.filter(isUnread).length, [tickets])
  const activeFilterLabel = useMemo(
    () => TICKET_FILTERS.find((item) => item.value === filter)?.label ?? "Open",
    [filter]
  )

  const selectedMessages = useMemo(
    () => messages.filter((message) => message.ticketId === selectedTicketId),
    [messages, selectedTicketId]
  )
  const latestVisitorMessage = useMemo(
    () => [...selectedMessages].reverse().find((message) => message.authorType === "visitor") ?? null,
    [selectedMessages]
  )
  const latestAgentMessage = useMemo(
    () => [...selectedMessages].reverse().find((message) => message.authorType === "agent") ?? null,
    [selectedMessages]
  )
  const latestVisitorSeenByAgent = Boolean(
    latestVisitorMessage &&
      selectedTicket?.lastAgentReadAt &&
      new Date(selectedTicket.lastAgentReadAt).getTime() >= new Date(latestVisitorMessage.createdAt).getTime()
  )
  const latestAgentSeenByVisitor = Boolean(
    latestAgentMessage &&
      selectedTicket?.lastVisitorReadAt &&
      new Date(selectedTicket.lastVisitorReadAt).getTime() >= new Date(latestAgentMessage.createdAt).getTime()
  )

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}?status=${filter}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load support tickets")
      const nextTickets = body?.tickets ?? []
      setTickets(nextTickets)
      setSelectedTicketId((current) => current ?? nextTickets[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets")
    } finally {
      setLoadingTickets(false)
    }
  }, [apiBase, filter])

  useEffect(() => {
    if (organizationId) return
    let cancelled = false

    async function loadOrganization() {
      try {
        const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, { credentials: "include" })
        const body = await response.json().catch(() => null)
        const id = body?.organization?._id ? String(body.organization._id) : ""
        if (!cancelled && response.ok && id) {
          setOrganizationId(id)
          setActiveOrganizationId(id)
        }
      } catch {
        // The page still works as an inbox; only the copyable public link depends on this.
      }
    }

    void loadOrganization()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const loadTicketDetail = useCallback(
    async (ticketId: string) => {
      setLoadingDetail(true)
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}`, { credentials: "include" })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to load ticket")
        setSelectedTicket(body.ticket)
        setMessages(body.messages ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ticket")
      } finally {
        setLoadingDetail(false)
      }
    },
    [apiBase]
  )

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicketId
    if (selectedTicketId) {
      void loadTicketDetail(selectedTicketId)
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "subscribe_ticket", ticketId: selectedTicketId }))
      }
    } else {
      setSelectedTicket(null)
      setMessages([])
    }
  }, [loadTicketDetail, selectedTicketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [selectedMessages.length, selectedTicketId])

  useEffect(() => {
    let stopped = false

    function connect() {
      if (stopped) return
      const socket = new WebSocket(wsUrl())
      socketRef.current = socket

      socket.addEventListener("open", () => {
        setSocketReady(true)
        const ticketId = selectedTicketIdRef.current
        if (ticketId) socket.send(JSON.stringify({ type: "subscribe_ticket", ticketId }))
      })

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as SocketEvent
        if (payload.type === "ticket.updated") {
          setTickets((current) => {
            const without = current.filter((ticket) => ticket.id !== payload.ticket.id)
            return ticketMatchesFilter(payload.ticket, filter)
              ? [payload.ticket, ...without].sort(
                  (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
                )
              : without
          })
          if (payload.ticket.id === selectedTicketIdRef.current) {
            setSelectedTicket(payload.ticket)
          }
        }
        if (payload.type === "message.created") {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.message.id)) return current
            return [...current, payload.message]
          })
          if (payload.message.ticketId === selectedTicketIdRef.current && payload.message.authorType === "visitor") {
            socket.send(JSON.stringify({ type: "mark_read", ticketId: payload.message.ticketId }))
          }
        }
        if (payload.type === "typing" && payload.actor === "visitor") {
          if (payload.ticketId === selectedTicketIdRef.current) setVisitorTyping(payload.isTyping)
        }
        if (payload.type === "error") setError(payload.error)
      })

      socket.addEventListener("close", () => {
        setSocketReady(false)
        if (!stopped) {
          reconnectRef.current = window.setTimeout(connect, 1500)
        }
      })

      socket.addEventListener("error", () => {
        setSocketReady(false)
      })
    }

    connect()
    return () => {
      stopped = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [filter])

  useEffect(() => {
    if (!selectedTicketId || !latestVisitorMessage || !socketReady) return
    socketRef.current?.send(JSON.stringify({ type: "mark_read", ticketId: selectedTicketId }))
  }, [latestVisitorMessage?.id, selectedTicketId, socketReady])

  useEffect(() => {
    setVisitorTyping(false)
  }, [selectedTicketId])

  const typingTimeoutRef = useRef<number | null>(null)
  const agentTypingRef = useRef(false)

  function sendTyping(isTyping: boolean) {
    if (!selectedTicketId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    if (agentTypingRef.current === isTyping) return
    agentTypingRef.current = isTyping
    socketRef.current.send(JSON.stringify({ type: "typing", ticketId: selectedTicketId, isTyping }))
  }

  function handleReplyChange(value: string) {
    setReply(value)
    sendTyping(Boolean(value.trim()))
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1200)
  }

  async function uploadAttachment(file: File): Promise<TicketAttachment> {
    const response = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "support",
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }),
    })
    const presign = await response.json().catch(() => null)
    if (!response.ok) throw new Error(presign?.error ?? `Unable to upload ${file.name}`)

    const upload = await fetch(presign.uploadUrl, {
      method: presign.method,
      headers: presign.headers,
      body: file,
    })
    if (!upload.ok) throw new Error(`Upload failed for ${file.name}`)

    return {
      key: presign.file.key,
      originalName: presign.file.originalName,
      contentType: presign.file.contentType,
      size: presign.file.size,
      url: presign.file.url,
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTicket || sending || (!reply.trim() && files.length === 0)) return
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Realtime connection is not ready. Please wait a moment and try again.")
      return
    }

    setSending(true)
    setError(null)
    try {
      const attachments = await Promise.all(files.map((item) => uploadAttachment(item.file)))
      socketRef.current.send(
        JSON.stringify({
          type: "agent_message",
          ticketId: selectedTicket.id,
          text: reply.trim(),
          attachments,
        })
      )
      setReply("")
      setFiles([])
      sendTyping(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  function changeTicketStatus(next: "resolve_ticket" | "reopen_ticket") {
    if (!selectedTicket || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    socketRef.current.send(JSON.stringify({ type: next, ticketId: selectedTicket.id }))
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const next = Array.from(fileList)
      .slice(0, Math.max(0, 5 - files.length))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file }))
    setFiles((current) => [...current, ...next].slice(0, 5))
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Support" }]}
        actions={
          <>
            <Badge variant={socketReady ? "secondary" : "outline"} className="gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  socketReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                )}
              />
              {socketReady ? "Realtime" : "Connecting"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void loadTickets()}>
              <RefreshCcwIcon />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col bg-background">
        {supportChatLink && (
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Public chat link</span>
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-foreground">
              {supportChatLink}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(supportChatLink, "Support chat link copied")}
            >
              <CopyIcon />
              Copy
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={supportChatLink} target="_blank" rel="noreferrer" aria-label="Open support chat">
                <ExternalLinkIcon />
              </a>
            </Button>
          </div>
        )}

        {error && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

      <main className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="flex items-center gap-1.5 border-b p-2">
            {TICKET_FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filter === item.value ? "default" : "ghost"}
                className="gap-1.5"
                onClick={() => {
                  setFilter(item.value)
                  setSelectedTicketId(null)
                }}
              >
                {item.label}
                {item.value === "open" && unreadCount > 0 && (
                  <Badge
                    variant={filter === item.value ? "secondary" : "default"}
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {!loadingTickets && tickets.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>{activeFilterLabel}</span>
              <span className="tabular-nums">{tickets.length}</span>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingTickets ? (
              <div className="flex flex-col">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-start gap-3 border-b p-4">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                  <InboxIcon className="size-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No Tickets Found</p>
                <p className="mt-1 max-w-[15rem] text-sm text-muted-foreground">
                  New support chats from your customers will appear here.
                </p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const unread = isUnread(ticket)
                const selected = selectedTicketId === ticket.id
                const avatar = getAvatarColor(ticket.requester.name)
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-l-2 border-l-transparent p-4 text-left transition hover:bg-muted/60",
                      selected && "border-l-primary bg-muted",
                      unread && !selected && "bg-primary/5"
                    )}
                  >
                    <Avatar className="mt-0.5">
                      <AvatarFallback className={cn("font-medium", avatar.bg, avatar.text)}>
                        {initialsFromName(ticket.requester.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                          )}
                        >
                          {ticket.requester.name}
                        </p>
                        <span
                          className="shrink-0 text-xs text-muted-foreground tabular-nums"
                          title={formatFullTime(ticket.lastMessageAt)}
                        >
                          {formatRelativeTime(ticket.lastMessageAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 line-clamp-1 text-sm",
                          unread ? "text-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        <span className="text-muted-foreground">#{ticket.ticketNumber}</span>{" "}
                        {ticket.subject || "New support chat"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs capitalize",
                            ticket.status === "resolved" ? "text-muted-foreground" : "text-foreground/70"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              ticket.status === "resolved" ? "bg-muted-foreground/40" : "bg-emerald-500"
                            )}
                          />
                          {ticket.status}
                        </span>
                        {unread && (
                          <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {!selectedTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
              <InboxIcon className="mb-3 size-10" />
              <p className="text-sm font-medium text-foreground">Select a Ticket</p>
              <p className="mt-1 text-sm">Choose a support conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    #{selectedTicket.ticketNumber} {selectedTicket.requester.name}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">{selectedTicket.requester.email}</p>
                </div>
                <Button
                  type="button"
                  variant={selectedTicket.status === "resolved" ? "outline" : "secondary"}
                  size="sm"
                  onClick={() =>
                    changeTicketStatus(selectedTicket.status === "resolved" ? "reopen_ticket" : "resolve_ticket")
                  }
                  disabled={!socketReady}
                >
                  <CheckCircle2Icon />
                  {selectedTicket.status === "resolved" ? "Reopen" : "Resolve"}
                </Button>
              </div>
              <div className="border-b px-5 py-2 text-xs text-muted-foreground">
                {latestVisitorMessage && !latestVisitorSeenByAgent ? (
                  <span>Unread customer reply</span>
                ) : latestAgentMessage && latestAgentSeenByVisitor ? (
                  <span>Visitor has seen your latest reply</span>
                ) : latestAgentMessage ? (
                  <span>Latest reply sent</span>
                ) : (
                  <span>Conversation opened</span>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-5 py-5">
                {loadingDetail ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <LoaderIcon className="size-5 animate-spin" />
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {selectedMessages.map((message) => {
                      const isAgent = message.authorType === "agent"
                      const isVisitor = message.authorType === "visitor"
                      return (
                        <div
                          key={message.id}
                          className={cn("flex", isAgent ? "justify-end" : "justify-start")}
                        >
                          <div
                            title={formatFullTime(message.createdAt)}
                            className={cn(
                              "max-w-[82%] rounded-2xl border bg-background px-4 py-3 text-sm shadow-xs",
                              isAgent && "border-primary/20 bg-primary text-primary-foreground",
                              isVisitor && "rounded-bl-md",
                              isAgent && "rounded-br-md"
                            )}
                          >
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">
                              {isAgent
                                ? "Support Team"
                                : message.authorType === "bot"
                                  ? "Assistant"
                                  : selectedTicket.requester.name}
                            </p>
                            {message.bodyText && <p className="whitespace-pre-wrap leading-relaxed">{message.bodyText}</p>}
                            {message.attachments.length > 0 && (
                              <div className="mt-3 grid gap-2">
                                {message.attachments.map((attachment) => (
                                  <a
                                    key={attachment.key}
                                    href={attachment.url ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs text-foreground",
                                      !attachment.url && "pointer-events-none opacity-60"
                                    )}
                                  >
                                    <FileIcon className="size-4" />
                                    <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
                                    <span className="shrink-0 text-muted-foreground">{fileSize(attachment.size)}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                            <p className="mt-2 text-[11px] opacity-60">
                              {formatTime(message.createdAt)}
                              {isAgent && latestAgentMessage?.id === message.id && latestAgentSeenByVisitor ? " · Seen" : ""}
                              {isVisitor && latestVisitorMessage?.id === message.id && latestVisitorSeenByAgent ? " · Read" : ""}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <form onSubmit={sendReply} className="border-t bg-background p-4">
                {visitorTyping && (
                  <p className="mb-2 text-xs text-muted-foreground">Customer is typing...</p>
                )}
                {files.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {files.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs"
                      >
                        <PaperclipIcon className="size-3" />
                        {item.file.name}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md border hover:bg-muted">
                    <PaperclipIcon className="size-4" />
                    <input
                      type="file"
                      className="sr-only"
                      multiple
                      onChange={(event) => {
                        addFiles(event.target.files)
                        event.target.value = ""
                      }}
                    />
                  </label>
                  <textarea
                    value={reply}
                    onChange={(event) => handleReplyChange(event.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                    className="min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  <Button type="submit" disabled={sending || !socketReady || (!reply.trim() && files.length === 0)}>
                    {sending ? <LoaderIcon className="animate-spin" /> : <SendIcon />}
                    Send
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
      </div>
    </AppLayout>
  )
}
