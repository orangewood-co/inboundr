import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { API_ORIGIN, getEmbedOrigin } from "@/lib/env"
import { getActiveOrganizationId, setActiveOrganizationId } from "@/lib/organization-context"
import { previewFromMessage, ticketMatchesFilter } from "./support-utils"
import type {
  SocketEvent,
  SupportAiDraft,
  SupportTicketTag,
  Ticket,
  TicketAttachment,
  TicketFilter,
  TicketMessage,
} from "./types"

const DEFAULT_PAGE_SIZE = 25

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

function byRecency(a: Ticket, b: Ticket) {
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
}

function ticketMatchesSearchQuery(ticket: Ticket, search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return true
  const ticketNumber = term.replace(/^#/, "")
  return [
    ticket.subject,
    ticket.initialIssue,
    ticket.requester.name,
    ticket.requester.email,
    ticket.lastMessagePreview ?? "",
    `#${ticket.ticketNumber}`,
    String(ticket.ticketNumber),
  ].some((value) => value.toLowerCase().includes(ticketNumber || term))
}

function ticketWithPreviewFallback(ticket: Ticket, existing?: Ticket): Ticket {
  const fallbackPreview =
    ticket.lastMessagePreview ||
    existing?.lastMessagePreview ||
    ticket.initialIssue.trim() ||
    ticket.subject.trim() ||
    "New support chat"
  return {
    ...ticket,
    lastMessagePreview: fallbackPreview,
    lastMessageAuthorType:
      ticket.lastMessageAuthorType ??
      existing?.lastMessageAuthorType ??
      (ticket.lastVisitorMessageAt ? "visitor" : ticket.lastMessageAuthorType ?? null),
    lastMessageIsInternal: ticket.lastMessageIsInternal ?? existing?.lastMessageIsInternal ?? false,
    agents: ticket.agents ?? existing?.agents ?? null,
  }
}

export type SendMessageInput = {
  text: string
  files?: File[]
  isInternal?: boolean
}

export type SupportListQuery = {
  status: TicketFilter
  search: string
  tags: string[]
  page: number
  limit: number
}

function ticketMatchesTagFilter(ticket: Ticket, tagIds: string[]) {
  if (tagIds.length === 0) return true
  const ticketTagIds = new Set((ticket.tags ?? []).map((tag) => tag.id))
  return tagIds.some((id) => ticketTagIds.has(id))
}

export type SupportPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

const DEFAULT_QUERY: SupportListQuery = {
  status: "open",
  search: "",
  tags: [],
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
}

function useSupportInboxValue() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [pagination, setPagination] = useState<SupportPagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [ticketTags, setTicketTags] = useState<SupportTicketTag[]>([])
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [aiDrafts, setAiDrafts] = useState<SupportAiDraft[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [socketReady, setSocketReady] = useState(false)
  const [visitorTyping, setVisitorTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState(() => getActiveOrganizationId() ?? "")

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const selectedTicketIdRef = useRef<string | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const agentTypingRef = useRef(false)
  const queryRef = useRef<SupportListQuery>(DEFAULT_QUERY)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastNewChatSoundAtRef = useRef(0)

  const apiBase = `${API_ORIGIN}/api/v1/tickets`

  const supportChatLink = useMemo(
    () => (organizationId ? `${getEmbedOrigin()}/support/${organizationId}` : ""),
    [organizationId]
  )

  function playNewChatSound() {
    if (document.visibilityState !== "visible") return
    const now = Date.now()
    if (now - lastNewChatSoundAtRef.current < 700) return
    lastNewChatSoundAtRef.current = now
    try {
      const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext
      if (!AudioContextCtor) return
      const context = audioContextRef.current ?? new AudioContextCtor()
      audioContextRef.current = context
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(660, context.currentTime)
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.08)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.24)
    } catch {
      // Browsers can block audio before user interaction.
    }
  }

  const selectedMessages = useMemo(
    () => messages.filter((message) => message.ticketId === selectedTicketId),
    [messages, selectedTicketId]
  )
  const selectedAiDrafts = useMemo(
    () => aiDrafts.filter((draft) => draft.ticketId === selectedTicketId && draft.status === "pending"),
    [aiDrafts, selectedTicketId]
  )

  const latestVisitorMessage = useMemo(
    () => [...selectedMessages].reverse().find((message) => message.authorType === "visitor") ?? null,
    [selectedMessages]
  )
  const latestAgentMessage = useMemo(
    () =>
      [...selectedMessages]
        .reverse()
        .find((message) => message.authorType === "agent" && !message.isInternal) ?? null,
    [selectedMessages]
  )
  const latestVisitorSeenByAgent = Boolean(
    latestVisitorMessage &&
      selectedTicket?.lastAgentReadAt &&
      new Date(selectedTicket.lastAgentReadAt).getTime() >=
        new Date(latestVisitorMessage.createdAt).getTime()
  )
  const latestAgentSeenByVisitor = Boolean(
    latestAgentMessage &&
      selectedTicket?.lastVisitorReadAt &&
      new Date(selectedTicket.lastVisitorReadAt).getTime() >=
        new Date(latestAgentMessage.createdAt).getTime()
  )

  const loadTickets = useCallback(
    async (query: SupportListQuery) => {
      queryRef.current = query
      setLoadingTickets(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          status: query.status,
          page: String(query.page),
          limit: String(query.limit),
        })
        if (query.search.trim()) params.set("search", query.search.trim())
        if (query.tags.length > 0) params.set("tags", query.tags.join(","))
        const response = await fetch(`${apiBase}?${params.toString()}`, { credentials: "include" })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to load support tickets")
        setTickets(body?.tickets ?? [])
        setPagination({
          page: body?.page ?? query.page,
          limit: body?.limit ?? query.limit,
          total: body?.total ?? 0,
          totalPages: body?.totalPages ?? 1,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load support tickets")
      } finally {
        setLoadingTickets(false)
      }
    },
    [apiBase]
  )

  const refresh = useCallback(() => loadTickets(queryRef.current), [loadTickets])

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
        setAiDrafts(body.aiDrafts ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ticket")
      } finally {
        setLoadingDetail(false)
      }
    },
    [apiBase]
  )

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
        // The inbox still works; only the public chat link needs this.
      }
    }
    void loadOrganization()
    return () => {
      cancelled = true
    }
  }, [organizationId])

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
      setAiDrafts([])
    }
  }, [loadTicketDetail, selectedTicketId])

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
          const query = queryRef.current
          const filter = query.status
          let insertedNewTicket = false
          setTickets((current) => {
            const existing = current.find((ticket) => ticket.id === payload.ticket.id)
            if (!existing) {
              if (
                query.page !== 1 ||
                !ticketMatchesFilter(payload.ticket, filter) ||
                !ticketMatchesSearchQuery(payload.ticket, query.search) ||
                !ticketMatchesTagFilter(payload.ticket, query.tags)
              ) {
                return current
              }
              insertedNewTicket = true
              const inserted = ticketWithPreviewFallback(payload.ticket)
              const next = [inserted, ...current].sort(byRecency).slice(0, query.limit)
              setPagination((pagination) => ({
                ...pagination,
                total: pagination.total + 1,
                totalPages: Math.max(Math.ceil((pagination.total + 1) / pagination.limit), 1),
              }))
              return next
            }
            const without = current.filter((ticket) => ticket.id !== payload.ticket.id)
            if (
              !ticketMatchesFilter(payload.ticket, filter) ||
              !ticketMatchesTagFilter(payload.ticket, query.tags)
            )
              return without
            const merged = ticketWithPreviewFallback(payload.ticket, existing)
            return [merged, ...without].sort(byRecency)
          })
          if (insertedNewTicket) playNewChatSound()
          if (payload.ticket.id === selectedTicketIdRef.current) {
            setSelectedTicket((current) => ({ ...current, ...payload.ticket }))
          }
        }
        if (payload.type === "ticket.deleted") {
          setTickets((current) => current.filter((ticket) => ticket.id !== payload.ticketId))
          if (payload.ticketId === selectedTicketIdRef.current) {
            setSelectedTicket(null)
            setMessages([])
            setAiDrafts([])
          }
        }
        if (payload.type === "message.created") {
          const message = payload.message
          setMessages((current) => {
            if (current.some((existing) => existing.id === message.id)) return current
            return [...current, message]
          })
          setTickets((current) => {
            const bump = !message.isInternal
            const next = current.map((ticket) =>
              ticket.id === message.ticketId
                ? {
                    ...ticket,
                    lastMessagePreview: previewFromMessage(message),
                    lastMessageAuthorType: message.authorType,
                    lastMessageIsInternal: message.isInternal,
                    ...(bump ? { lastMessageAt: message.createdAt } : {}),
                  }
                : ticket
            )
            return bump ? [...next].sort(byRecency) : next
          })
          if (message.ticketId === selectedTicketIdRef.current && message.authorType === "visitor") {
            socket.send(JSON.stringify({ type: "mark_read", ticketId: message.ticketId }))
          }
        }
        if (payload.type === "ai_draft.created") {
          const draft = payload.draft
          setAiDrafts((current) => {
            if (current.some((existing) => existing.id === draft.id)) return current
            return [...current, draft]
          })
        }
        if (payload.type === "ai_draft.updated") {
          const draft = payload.draft
          setAiDrafts((current) => {
            const without = current.filter((existing) => existing.id !== draft.id)
            return draft.status === "pending" ? [...without, draft] : without
          })
        }
        if (payload.type === "typing" && payload.actor === "visitor") {
          if (payload.ticketId === selectedTicketIdRef.current) setVisitorTyping(payload.isTyping)
        }
        if (payload.type === "error") setError(payload.error)
      })

      socket.addEventListener("close", () => {
        setSocketReady(false)
        if (!stopped) reconnectRef.current = window.setTimeout(connect, 1500)
      })

      socket.addEventListener("error", () => setSocketReady(false))
    }

    connect()
    return () => {
      stopped = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!selectedTicketId || !latestVisitorMessage || !socketReady) return
    socketRef.current?.send(JSON.stringify({ type: "mark_read", ticketId: selectedTicketId }))
  }, [latestVisitorMessage?.id, selectedTicketId, socketReady])

  useEffect(() => {
    setVisitorTyping(false)
  }, [selectedTicketId])

  const notifyTyping = useCallback((isTyping: boolean) => {
    const ticketId = selectedTicketIdRef.current
    if (!ticketId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    if (agentTypingRef.current === isTyping) return
    agentTypingRef.current = isTyping
    socketRef.current.send(JSON.stringify({ type: "typing", ticketId, isTyping }))
  }, [])

  const handleDraftChange = useCallback(
    (value: string) => {
      notifyTyping(Boolean(value.trim()))
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = window.setTimeout(() => notifyTyping(false), 1200)
    },
    [notifyTyping]
  )

  const uploadAttachment = useCallback(async (file: File): Promise<TicketAttachment> => {
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
  }, [])

  const sendMessage = useCallback(
    async ({ text, files = [], isInternal = false }: SendMessageInput): Promise<boolean> => {
      const ticket = selectedTicket
      const trimmed = text.trim()
      if (!ticket || sending || (!trimmed && files.length === 0)) return false
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setError("Realtime connection is not ready. Please wait a moment and try again.")
        return false
      }

      setSending(true)
      setError(null)
      try {
        const attachments = await Promise.all(files.map((file) => uploadAttachment(file)))
        socketRef.current.send(
          JSON.stringify({
            type: "agent_message",
            ticketId: ticket.id,
            text: trimmed,
            attachments,
            isInternal,
          })
        )
        notifyTyping(false)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send reply")
        return false
      } finally {
        setSending(false)
      }
    },
    [notifyTyping, selectedTicket, sending, uploadAttachment]
  )

  const setStatus = useCallback((resolved: boolean) => {
    const ticketId = selectedTicketIdRef.current
    if (!ticketId || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    socketRef.current.send(
      JSON.stringify({ type: resolved ? "resolve_ticket" : "reopen_ticket", ticketId })
    )
  }, [])

  const setAiMode = useCallback(
    async (aiMode: Ticket["aiMode"]): Promise<boolean> => {
      const ticketId = selectedTicketIdRef.current
      if (!ticketId) return false
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}/ai-mode`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiMode }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to update AI mode")
        if (body?.ticket) {
          setSelectedTicket((current) => (current?.id === body.ticket.id ? body.ticket : current))
          setTickets((current) =>
            current.map((ticket) => (ticket.id === body.ticket.id ? { ...ticket, ...body.ticket } : ticket))
          )
        }
        if (aiMode !== "review") setAiDrafts((current) => current.filter((draft) => draft.ticketId !== ticketId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update AI mode")
        return false
      }
    },
    [apiBase]
  )

  const generateAiDraft = useCallback(async (): Promise<boolean> => {
    const ticketId = selectedTicketIdRef.current
    if (!ticketId) return false
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}/${ticketId}/ai-drafts`, {
        method: "POST",
        credentials: "include",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to generate AI draft")
      if (body?.draft) {
        setAiDrafts((current) => {
          if (current.some((draft) => draft.id === body.draft.id)) return current
          return [...current, body.draft]
        })
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI draft")
      return false
    } finally {
      setSending(false)
    }
  }, [apiBase])

  const approveAiDraft = useCallback(
    async (draftId: string, bodyText: string): Promise<boolean> => {
      const ticketId = selectedTicketIdRef.current
      const trimmed = bodyText.trim()
      if (!ticketId || !trimmed) return false
      setSending(true)
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}/ai-drafts/${draftId}/approve`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyText: trimmed }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to approve AI draft")
        setAiDrafts((current) => current.filter((draft) => draft.id !== draftId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve AI draft")
        return false
      } finally {
        setSending(false)
      }
    },
    [apiBase]
  )

  const rejectAiDraft = useCallback(
    async (draftId: string): Promise<boolean> => {
      const ticketId = selectedTicketIdRef.current
      if (!ticketId) return false
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}/ai-drafts/${draftId}/reject`, {
          method: "PATCH",
          credentials: "include",
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to reject AI draft")
        setAiDrafts((current) => current.filter((draft) => draft.id !== draftId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject AI draft")
        return false
      }
    },
    [apiBase]
  )

  const setArchived = useCallback(
    async (ticketId: string, archived: boolean): Promise<boolean> => {
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}/${archived ? "archive" : "unarchive"}`, {
          method: "PATCH",
          credentials: "include",
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to update conversation")
        // Drop the row locally if it no longer belongs to the current view;
        // the WebSocket broadcast keeps other agents in sync.
        setTickets((current) => current.filter((ticket) => ticket.id !== ticketId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update conversation")
        return false
      }
    },
    [apiBase]
  )

  const archiveTicket = useCallback((ticketId: string) => setArchived(ticketId, true), [setArchived])
  const unarchiveTicket = useCallback(
    (ticketId: string) => setArchived(ticketId, false),
    [setArchived]
  )

  const deleteTicket = useCallback(
    async (ticketId: string): Promise<boolean> => {
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}`, {
          method: "DELETE",
          credentials: "include",
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to delete conversation")
        setTickets((current) => current.filter((ticket) => ticket.id !== ticketId))
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete conversation")
        return false
      }
    },
    [apiBase]
  )

  const loadTicketTags = useCallback(async () => {
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags`, {
        credentials: "include",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load ticket tags")
      setTicketTags(body?.tags ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket tags")
    }
  }, [])

  useEffect(() => {
    void loadTicketTags()
  }, [loadTicketTags])

  const createTicketTag = useCallback(
    async (input: { name: string; color: string }): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to create tag")
        await loadTicketTags()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create tag")
        return false
      }
    },
    [loadTicketTags]
  )

  const updateTicketTag = useCallback(
    async (tagId: string, input: { name?: string; color?: string }): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags/${tagId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to update tag")
        await loadTicketTags()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update tag")
        return false
      }
    },
    [loadTicketTags]
  )

  const deleteTicketTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags/${tagId}`, {
          method: "DELETE",
          credentials: "include",
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to delete tag")
        setTicketTags((current) => current.filter((tag) => tag.id !== tagId))
        setTickets((current) =>
          current.map((ticket) => ({
            ...ticket,
            tags: (ticket.tags ?? []).filter((tag) => tag.id !== tagId),
          }))
        )
        setSelectedTicket((current) =>
          current
            ? { ...current, tags: (current.tags ?? []).filter((tag) => tag.id !== tagId) }
            : current
        )
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete tag")
        return false
      }
    },
    []
  )

  const updateTicketTags = useCallback(
    async (ticketId: string, tagIds: string[]): Promise<boolean> => {
      setError(null)
      try {
        const response = await fetch(`${apiBase}/${ticketId}/tags`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Failed to update ticket tags")
        if (body?.ticket) {
          setSelectedTicket((current) =>
            current?.id === body.ticket.id ? { ...current, ...body.ticket } : current
          )
          setTickets((current) =>
            current.map((ticket) =>
              ticket.id === body.ticket.id ? { ...ticket, tags: body.ticket.tags } : ticket
            )
          )
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update ticket tags")
        return false
      }
    },
    [apiBase]
  )

  const selectTicket = useCallback((ticketId: string | null) => {
    setSelectedTicketId(ticketId)
  }, [])

  const unreadCount = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (!ticket.lastVisitorMessageAt) return false
        if (!ticket.lastAgentReadAt) return true
        return new Date(ticket.lastVisitorMessageAt) > new Date(ticket.lastAgentReadAt)
      }).length,
    [tickets]
  )

  return {
    tickets,
    pagination,
    loadingTickets,
    unreadCount,
    ticketTags,
    loadTickets,
    loadTicketTags,
    createTicketTag,
    updateTicketTag,
    deleteTicketTag,
    updateTicketTags,
    refresh,
    selectedTicketId,
    selectTicket,
    selectedTicket,
    messages: selectedMessages,
    aiDrafts: selectedAiDrafts,
    loadingDetail,
    socketReady,
    sending,
    visitorTyping,
    error,
    organizationId,
    supportChatLink,
    sendMessage,
    setStatus,
    setAiMode,
    generateAiDraft,
    approveAiDraft,
    rejectAiDraft,
    archiveTicket,
    unarchiveTicket,
    deleteTicket,
    notifyTyping,
    handleDraftChange,
    uploadAttachment,
    latestAgentMessage,
    latestVisitorMessage,
    latestVisitorSeenByAgent,
    latestAgentSeenByVisitor,
  }
}

export type SupportInbox = ReturnType<typeof useSupportInboxValue>

const SupportContext = createContext<SupportInbox | null>(null)

export function SupportProvider({ children }: { children: ReactNode }) {
  const value = useSupportInboxValue()
  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>
}

export function useSupport(): SupportInbox {
  const context = useContext(SupportContext)
  if (!context) throw new Error("useSupport must be used within a SupportProvider")
  return context
}
