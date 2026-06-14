import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  AlertCircleIcon,
  CheckIcon,
  CircleCheckIcon,
  EllipsisVerticalIcon,
  FileIcon,
  HeadsetIcon,
  LoaderIcon,
  PaperclipIcon,
  SendIcon,
  StarIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { API_ORIGIN } from "@/lib/env"
import chatConnectedSound from "@/assets/support/chat-connected.mp3"
import messageReceivedSound from "@/assets/support/message-received.mp3"

type SupportOrganization = {
  _id: string
  name: string
  logoUrl: string
  primaryColor: string
}

type SupportMessage = {
  id: string
  authorType: "visitor" | "bot" | "agent" | "system"
  bodyText: string
  attachments: SupportAttachment[]
  createdAt: string
}

type SupportAttachment = {
  key: string
  originalName: string
  contentType: string
  size: number
  url: string | null
}

type PendingAttachment = {
  id: string
  file: File
}

type SocketEvent =
  | { type: "connected" }
  | { type: "message.created"; message: SupportMessage }
  | { type: "ticket.updated"; ticket: SupportTicket }
  | { type: "typing"; ticketId: string; actor: "agent" | "visitor"; isTyping: boolean }
  | { type: "error"; error: string }
  | { type: "pong" }

type SupportTicket = {
  id: string
  lastVisitorMessageAt: string | null
  lastAgentMessageAt: string | null
  lastVisitorReadAt: string | null
  lastAgentReadAt: string | null
}

type Phase = "loading" | "unavailable" | "prechat" | "chat" | "ended"

const MESSAGE_MAX_LENGTH = 4000
const MUTE_STORAGE_KEY = "inboundr-support-muted"

function sessionStorageKey(organizationId: string) {
  return `inboundr-support-session:${organizationId}`
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-bounce rounded-full bg-stone-400"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </span>
  )
}

function supportWsUrl(sessionToken: string) {
  const url = new URL(API_ORIGIN)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/api/v1/support/ws"
  url.search = ""
  url.searchParams.set("mode", "visitor")
  url.searchParams.set("sessionToken", sessionToken)
  return url.toString()
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
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

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace("#", "").trim()
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized
  if (full.length !== 6) return null
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return null
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** Picks a legible foreground color (near-black or white) for a given background hex. */
function readableTextColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#ffffff"
  const [r, g, b] = rgb
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#1c1917" : "#ffffff"
}

/** Lightens (positive amount) or darkens (negative amount) a hex color. */
function adjustColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const channels = rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel + amount))))
  return `#${((channels[0] << 16) | (channels[1] << 8) | channels[2]).toString(16).padStart(6, "0")}`
}

function useSupportSounds() {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1"
    } catch {
      return false
    }
  })
  const mutedRef = useRef(muted)
  const connectedAudioRef = useRef<HTMLAudioElement | null>(null)
  const receivedAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    mutedRef.current = muted
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0")
    } catch {
      // Ignore persistence failures (private mode, disabled storage, etc.).
    }
  }, [muted])

  useEffect(() => {
    const connected = new Audio(chatConnectedSound)
    const received = new Audio(messageReceivedSound)
    connected.preload = "auto"
    received.preload = "auto"
    connected.volume = 0.5
    received.volume = 0.45
    connectedAudioRef.current = connected
    receivedAudioRef.current = received
    return () => {
      connected.pause()
      received.pause()
      connectedAudioRef.current = null
      receivedAudioRef.current = null
    }
  }, [])

  const play = useCallback((audio: HTMLAudioElement | null) => {
    if (mutedRef.current || !audio) return
    try {
      audio.currentTime = 0
      void audio.play().catch(() => {})
    } catch {
      // Autoplay can be blocked before a user gesture; fail silently.
    }
  }, [])

  const playConnected = useCallback(() => play(connectedAudioRef.current), [play])
  const playReceived = useCallback(() => play(receivedAudioRef.current), [play])
  const toggleMuted = useCallback(() => setMuted((value) => !value), [])

  return { muted, toggleMuted, playConnected, playReceived }
}

export default function SupportPage({ organizationId }: { organizationId: string }) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [organization, setOrganization] = useState<SupportOrganization | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState("Support chat is unavailable")

  const [issue, setIssue] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [emailCopy, setEmailCopy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [visitorName, setVisitorName] = useState("")

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [socketReady, setSocketReady] = useState(false)
  const [agentTyping, setAgentTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)

  const { muted, toggleMuted, playConnected, playReceived } = useSupportSounds()

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const visitorTypingRef = useRef(false)
  const connectedPlayedRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const apiBase = `${API_ORIGIN}/api/v1/public/support`
  const latestVisitorMessage = [...messages].reverse().find((message) => message.authorType === "visitor") ?? null
  const latestVisitorSeenBySupport = Boolean(
    latestVisitorMessage &&
      ticket?.lastAgentReadAt &&
      new Date(ticket.lastAgentReadAt).getTime() >= new Date(latestVisitorMessage.createdAt).getTime()
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const storedToken = window.localStorage.getItem(sessionStorageKey(organizationId))

      if (storedToken) {
        try {
          const response = await fetch(`${apiBase}/session/${storedToken}`)
          const body = await response.json().catch(() => null)
          if (cancelled) return
          if (response.ok && body) {
            setOrganization(body.organization)
            setTicket(body.ticket ?? null)
            setMessages(body.messages ?? [])
            setSessionToken(storedToken)
            setPhase("chat")
            return
          }
          window.localStorage.removeItem(sessionStorageKey(organizationId))
        } catch {
          // Fall through to the workspace lookup below.
        }
      }

      try {
        const response = await fetch(`${apiBase}/workspace/${organizationId}`)
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || !body?.organization) {
          setUnavailableMessage(body?.error ?? "Support chat is unavailable")
          setPhase("unavailable")
          return
        }
        setOrganization(body.organization)
        setPhase("prechat")
      } catch {
        if (cancelled) return
        setUnavailableMessage("Could not reach the support service. Please try again.")
        setPhase("unavailable")
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [apiBase, organizationId])

  useEffect(() => {
    for (const message of messages) seenIdsRef.current.add(message.id)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, streamingText, agentTyping, phase])

  useEffect(() => {
    const element = composerRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`
  }, [draft, phase])

  useEffect(() => {
    if (phase !== "chat" || !sessionToken) return
    let stopped = false

    function connect() {
      if (stopped || !sessionToken) return
      const socket = new WebSocket(supportWsUrl(sessionToken))
      socketRef.current = socket

      socket.addEventListener("open", () => {
        setSocketReady(true)
        socket.send(JSON.stringify({ type: "mark_read" }))
        if (!connectedPlayedRef.current) {
          connectedPlayedRef.current = true
          playConnected()
        }
      })

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as SocketEvent
        if (payload.type === "message.created") {
          const incoming = payload.message
          const alreadySeen = seenIdsRef.current.has(incoming.id)
          seenIdsRef.current.add(incoming.id)
          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) return current
            return [...current, incoming]
          })
          if (!alreadySeen && incoming.authorType !== "visitor") {
            playReceived()
          }
          if (incoming.authorType === "agent") {
            socket.send(JSON.stringify({ type: "mark_read" }))
          }
        }
        if (payload.type === "ticket.updated") {
          setTicket(payload.ticket)
        }
        if (payload.type === "typing" && payload.actor === "agent") {
          setAgentTyping(payload.isTyping)
        }
        if (payload.type === "error") setError(payload.error)
      })

      socket.addEventListener("close", () => {
        setSocketReady(false)
        if (!stopped) reconnectRef.current = window.setTimeout(connect, 1500)
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
  }, [phase, sessionToken, playConnected, playReceived])

  async function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStarting(true)
    setError(null)
    connectedPlayedRef.current = false
    try {
      const response = await fetch(`${apiBase}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name,
          email,
          subject: issue.trim(),
          emailTranscript: emailCopy,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.sessionToken) {
        throw new Error(body?.error ?? "Failed to start support chat")
      }
      window.localStorage.setItem(sessionStorageKey(organizationId), body.sessionToken)
      setVisitorName(name.trim())
      setSessionToken(body.sessionToken)
      setOrganization(body.organization)
      setTicket(body.ticket ?? null)
      setMessages(body.messages ?? [])
      setPhase("chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start support chat")
    } finally {
      setStarting(false)
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const text = draft.trim()
    if ((!text && files.length === 0) || sending || !sessionToken) return

    setDraft("")
    setSending(true)
    setStreamingText("")
    setError(null)

    try {
      const attachments = await Promise.all(files.map((item) => uploadAttachment(item.file, sessionToken)))
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "visitor_message", text, attachments }))
        setFiles([])
        sendTyping(false)
        return
      }
      if (attachments.length > 0) {
        throw new Error("Realtime connection is required to send attachments. Please try again in a moment.")
      }
      setMessages((current) => [
        ...current,
        {
          id: `local-${Date.now()}`,
          authorType: "visitor",
          bodyText: text,
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ])

      const response = await fetch(`${apiBase}/session/${sessionToken}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setDraft(text)
        throw new Error(body?.error ?? "Failed to send message")
      }

      let reply = ""
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          reply += decoder.decode(value, { stream: true })
          setStreamingText(reply)
        }
        reply += new TextDecoder().decode()
      }

      if (reply.trim()) {
        setMessages((current) => [
          ...current,
          {
            id: `bot-${Date.now()}`,
            authorType: "bot",
            bodyText: reply.trim(),
            attachments: [],
            createdAt: new Date().toISOString(),
          },
        ])
        playReceived()
      }
    } catch (err) {
      setDraft(text)
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setStreamingText(null)
      setSending(false)
      requestAnimationFrame(() => document.getElementById("support-message-input")?.focus())
    }
  }

  function startNewChat() {
    window.localStorage.removeItem(sessionStorageKey(organizationId))
    socketRef.current?.close()
    if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
    connectedPlayedRef.current = false
    seenIdsRef.current = new Set()
    setSessionToken(null)
    setTicket(null)
    setMessages([])
    setDraft("")
    setFiles([])
    setError(null)
    setAgentTyping(false)
    setStreamingText(null)
    setSocketReady(false)
    setRating(0)
    setHoverRating(0)
    setMenuOpen(false)
    setIssue("")
    setEmailCopy(false)
    setPhase("prechat")
  }

  function endChat() {
    socketRef.current?.close()
    if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
    window.localStorage.removeItem(sessionStorageKey(organizationId))
    setMenuOpen(false)
    setSocketReady(false)
    setAgentTyping(false)
    setStreamingText(null)
    setPhase("ended")
  }

  async function uploadAttachment(file: File, token: string): Promise<SupportAttachment> {
    const response = await fetch(`${apiBase}/session/${token}/uploads/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const next = Array.from(fileList)
      .slice(0, Math.max(0, 5 - files.length))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file }))
    setFiles((current) => [...current, ...next].slice(0, 5))
  }

  function sendTyping(isTyping: boolean) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    if (visitorTypingRef.current === isTyping) return
    visitorTypingRef.current = isTyping
    socketRef.current.send(JSON.stringify({ type: "typing", isTyping }))
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    sendTyping(Boolean(value.trim()))
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1200)
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-stone-100 text-stone-400">
        <LoaderIcon className="size-6 animate-spin" />
      </main>
    )
  }

  if (phase === "unavailable" || !organization) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-stone-100 px-6">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <AlertCircleIcon className="mx-auto size-8 text-red-500" />
          <p className="mt-3 text-sm font-medium text-stone-700">{unavailableMessage}</p>
        </div>
      </main>
    )
  }

  const accent = organization.primaryColor || "#f5b400"
  const onAccent = readableTextColor(accent)
  const headerGradient = `linear-gradient(135deg, ${adjustColor(accent, 22)} 0%, ${accent} 55%, ${adjustColor(accent, -26)} 100%)`
  const orgInitial = organization.name.charAt(0).toUpperCase()

  const headerAvatar =
    organization.logoUrl && !logoBroken ? (
      <img
        src={organization.logoUrl}
        alt={organization.name}
        onError={() => setLogoBroken(true)}
        className="size-10 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-sm"
      />
    ) : (
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-base font-bold shadow-sm"
        style={{ color: accent }}
      >
        {orgInitial}
      </div>
    )

  const supportAvatar =
    organization.logoUrl && !logoBroken ? (
      <img
        src={organization.logoUrl}
        alt=""
        className="size-7 shrink-0 rounded-full bg-white object-contain ring-1 ring-stone-200"
      />
    ) : (
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        <HeadsetIcon className="size-3.5" />
      </div>
    )

  const renderHeader = (subtitle: React.ReactNode, showMenu: boolean) => (
    <header
      className="flex items-center gap-3 px-4 py-3.5"
      style={{ backgroundImage: headerGradient, color: onAccent }}
    >
      {headerAvatar}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{organization.name}</h1>
        <div className="mt-0.5 flex items-center text-xs" style={{ color: onAccent }}>
          {subtitle}
        </div>
      </div>
      {showMenu && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Chat options"
            className="flex size-9 items-center justify-center rounded-lg transition hover:bg-black/10"
            style={{ color: onAccent }}
          >
            <EllipsisVerticalIcon className="size-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 text-stone-700 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMuted}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-stone-50"
                >
                  {muted ? (
                    <VolumeXIcon className="size-4 text-stone-400" />
                  ) : (
                    <Volume2Icon className="size-4 text-stone-400" />
                  )}
                  {muted ? "Unmute sounds" : "Mute sounds"}
                </button>
                <button
                  type="button"
                  onClick={endChat}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                >
                  <XIcon className="size-4" />
                  End chat
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )

  const connectionStatus = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`size-1.5 shrink-0 rounded-full ${socketReady ? "bg-emerald-400" : "bg-amber-300"}`} />
      <span className="truncate opacity-90">
        {socketReady ? "Typically replies in a few minutes" : "Connecting…"}
      </span>
    </span>
  )

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-stone-100 sm:p-6">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[min(44rem,calc(100dvh-3rem))] sm:max-w-md sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-xl">
        {phase === "prechat" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="px-6 pt-7 pb-6" style={{ backgroundImage: headerGradient, color: onAccent }}>
              <div className="flex items-center gap-2.5">
                {headerAvatar}
                <span className="text-sm font-medium opacity-90">{organization.name}</span>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <h2 className="mt-5 text-2xl font-bold tracking-tight">Hi there 👋</h2>
                <p className="mt-1 text-sm opacity-90">
                  Tell us a bit about your issue and we&apos;ll connect you with the team.
                </p>
              </motion.div>
            </div>

            <form onSubmit={startChat} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
              <div className="grid gap-1.5">
                <Label htmlFor="support-issue">How can we help?</Label>
                <Textarea
                  id="support-issue"
                  value={issue}
                  onChange={(event) => setIssue(event.target.value)}
                  placeholder="Describe your issue or question…"
                  rows={3}
                  maxLength={2000}
                  autoFocus
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="support-name">Name</Label>
                <Input
                  id="support-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="support-email">Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <button
                type="button"
                onClick={() => setEmailCopy((value) => !value)}
                aria-pressed={emailCopy}
                className="flex items-start gap-3 rounded-xl border border-stone-200 px-3.5 py-3 text-left transition hover:bg-stone-50"
              >
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition"
                  style={
                    emailCopy
                      ? { backgroundColor: accent, borderColor: accent, color: onAccent }
                      : { borderColor: "#d6d3d1" }
                  }
                >
                  {emailCopy && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="text-sm text-stone-600">Email me a copy of this conversation</span>
              </button>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={starting || !issue.trim() || !name.trim() || !email.trim()}
                className="h-11"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                {starting && <LoaderIcon className="size-4 animate-spin" />}
                Start chat
              </Button>
              <p className="pt-1 text-center text-xs text-stone-400">Powered by Inboundr</p>
            </form>
          </div>
        )}

        {phase === "chat" && (
          <>
            {renderHeader(connectionStatus, true)}

            <div className="flex-1 space-y-1 overflow-y-auto px-4 py-5" aria-live="polite">
              {messages.length === 0 && streamingText === null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-end gap-2"
                >
                  {supportAvatar}
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-700">
                    {visitorName ? `Hi ${visitorName.split(/\s+/)[0]}! ` : "Hi! "}
                    Thanks for reaching out to {organization.name}. Someone from the team will be with you shortly — feel
                    free to share any extra details below.
                  </div>
                </motion.div>
              )}

              {messages.map((message) => {
                if (message.authorType === "system") {
                  return (
                    <div key={message.id} className="flex justify-center py-1.5">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
                        {message.bodyText}
                      </span>
                    </div>
                  )
                }

                const isVisitor = message.authorType === "visitor"
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`flex items-end gap-2 ${isVisitor ? "justify-end" : "justify-start"}`}
                  >
                    {!isVisitor && supportAvatar}
                    <div
                      title={formatFullTime(message.createdAt)}
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isVisitor ? "rounded-br-md" : "rounded-bl-md bg-stone-100 text-stone-800"
                      }`}
                      style={isVisitor ? { backgroundColor: accent, color: onAccent } : undefined}
                    >
                      {message.authorType === "agent" && (
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                          Support Team
                        </p>
                      )}
                      {message.bodyText && <p>{message.bodyText}</p>}
                      {message.attachments?.length > 0 && (
                        <div className="mt-2 grid gap-2">
                          {message.attachments.map((attachment) => (
                            <a
                              key={attachment.key}
                              href={attachment.url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                                isVisitor ? "" : "border-stone-200 bg-white text-stone-700"
                              } ${!attachment.url ? "pointer-events-none opacity-60" : ""}`}
                              style={
                                isVisitor
                                  ? {
                                      borderColor: `${onAccent}33`,
                                      backgroundColor: `${onAccent}14`,
                                      color: onAccent,
                                    }
                                  : undefined
                              }
                            >
                              <FileIcon className="size-3.5" />
                              <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
                              <span className="shrink-0 opacity-70">{fileSize(attachment.size)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      <p
                        className={`mt-1 text-[11px] ${isVisitor ? "" : "text-stone-500"}`}
                        style={isVisitor ? { color: onAccent, opacity: 0.7 } : undefined}
                      >
                        {formatTime(message.createdAt)}
                        {isVisitor && latestVisitorMessage?.id === message.id && latestVisitorSeenBySupport
                          ? " · Seen"
                          : ""}
                      </p>
                    </div>
                  </motion.div>
                )
              })}

              {streamingText !== null && (
                <div className="flex items-end gap-2">
                  {supportAvatar}
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-800">
                    {streamingText ? streamingText : <TypingDots />}
                  </div>
                </div>
              )}

              {agentTyping && (
                <div className="flex items-end gap-2">
                  {supportAvatar}
                  <div className="rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-3 text-stone-500">
                    <TypingDots />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="border-t border-stone-200 bg-white px-3 pt-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {files.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
                    >
                      <PaperclipIcon className="size-3" />
                      {item.file.name}
                      <button
                        type="button"
                        className="text-stone-400 hover:text-stone-700"
                        onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-stone-200 text-stone-500 transition hover:bg-stone-50">
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
                <Textarea
                  id="support-message-input"
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Type your message…"
                  maxLength={MESSAGE_MAX_LENGTH}
                  disabled={sending}
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 self-stretch"
                />
                <Button
                  type="submit"
                  disabled={sending || (!draft.trim() && files.length === 0)}
                  title="Send"
                  aria-label="Send"
                  className="size-11 shrink-0 rounded-xl p-0"
                  style={{ backgroundColor: accent, color: onAccent }}
                >
                  {sending ? <LoaderIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                </Button>
              </div>
            </form>
          </>
        )}

        {phase === "ended" && (
          <>
            {renderHeader(<span className="truncate opacity-90">Conversation closed</span>, false)}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
                className="flex size-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accent}1f` }}
              >
                <CircleCheckIcon className="size-8" style={{ color: accent }} />
              </motion.div>
              <h2 className="mt-5 text-xl font-bold text-stone-900">Chat ended</h2>
              <p className="mt-1.5 max-w-xs text-sm text-stone-500">
                Thanks for chatting with {organization.name}.{" "}
                {emailCopy
                  ? "A copy of this conversation is on its way to your inbox."
                  : "We hope we were able to help."}
              </p>

              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">How was your experience?</p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating)
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <StarIcon
                          className="size-7"
                          style={{ color: active ? accent : "#d6d3d1", fill: active ? accent : "none" }}
                        />
                      </button>
                    )
                  })}
                </div>
                {rating > 0 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-stone-500">
                    Thanks for your feedback!
                  </motion.p>
                )}
              </div>

              <Button
                type="button"
                onClick={startNewChat}
                className="mt-7 h-11 w-full max-w-xs"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                Start new chat
              </Button>
              <p className="mt-4 text-xs text-stone-400">Powered by Inboundr</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
