import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { API_ORIGIN, getEmbedOrigin } from "@/lib/env"
import { getActiveOrganizationId, setActiveOrganizationId } from "@/lib/organization-context"
import { previewFromMessage, ticketMatchesFilter } from "./support-utils"
import type {
  SocketEvent,
  Ticket,
  TicketAttachment,
  TicketFilter,
  TicketMessage,
} from "./types"

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

export type SendMessageInput = {
  text: string
  files?: File[]
  isInternal?: boolean
}

export function useSupportInbox() {
  const [filter, setFilterState] = useState<TicketFilter>("open")
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
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

  const apiBase = `${API_ORIGIN}/api/v1/tickets`

  const supportChatLink = useMemo(
    () => (organizationId ? `${getEmbedOrigin()}/support/${organizationId}` : ""),
    [organizationId]
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

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}?status=${filter}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load support tickets")
      const nextTickets: Ticket[] = body?.tickets ?? []
      setTickets(nextTickets)
      setSelectedTicketId((current) => current ?? nextTickets[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets")
    } finally {
      setLoadingTickets(false)
    }
  }, [apiBase, filter])

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
            const existing = current.find((ticket) => ticket.id === payload.ticket.id)
            const without = current.filter((ticket) => ticket.id !== payload.ticket.id)
            if (!ticketMatchesFilter(payload.ticket, filter)) return without
            // ticket.updated is serialized without the list-only preview fields,
            // so preserve whatever the list already knows.
            const merged: Ticket = {
              ...payload.ticket,
              lastMessagePreview: payload.ticket.lastMessagePreview ?? existing?.lastMessagePreview ?? null,
              lastMessageAuthorType:
                payload.ticket.lastMessageAuthorType ?? existing?.lastMessageAuthorType ?? null,
              lastMessageIsInternal:
                payload.ticket.lastMessageIsInternal ?? existing?.lastMessageIsInternal ?? false,
            }
            return [merged, ...without].sort(byRecency)
          })
          if (payload.ticket.id === selectedTicketIdRef.current) {
            setSelectedTicket((current) => ({ ...current, ...payload.ticket }))
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
  }, [filter])

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

  const setFilter = useCallback((next: TicketFilter) => {
    setFilterState(next)
    setSelectedTicketId(null)
  }, [])

  const selectTicket = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId)
  }, [])

  const unreadCount = useMemo(
    () => tickets.filter((ticket) => {
      if (!ticket.lastVisitorMessageAt) return false
      if (!ticket.lastAgentReadAt) return true
      return new Date(ticket.lastVisitorMessageAt) > new Date(ticket.lastAgentReadAt)
    }).length,
    [tickets]
  )

  return {
    filter,
    setFilter,
    tickets,
    loadingTickets,
    unreadCount,
    selectedTicketId,
    selectTicket,
    refresh: loadTickets,
    selectedTicket,
    messages: selectedMessages,
    loadingDetail,
    socketReady,
    sending,
    visitorTyping,
    error,
    organizationId,
    supportChatLink,
    sendMessage,
    setStatus,
    notifyTyping,
    handleDraftChange,
    uploadAttachment,
    latestAgentMessage,
    latestVisitorMessage,
    latestVisitorSeenByAgent,
    latestAgentSeenByVisitor,
  }
}

export type SupportInbox = ReturnType<typeof useSupportInbox>
