import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  AlertCircleIcon,
  CheckIcon,
  CircleCheckIcon,
  EllipsisVerticalIcon,
  FileIcon,
  HeadsetIcon,
  LoaderIcon,
  MoonIcon,
  PaperclipIcon,
  SendIcon,
  StarIcon,
  SunIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AudioPlayer } from "@/components/audio-player"
import { VoiceRecorder } from "@/components/voice-recorder"
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
  audioUrl?: string
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
  status: "open" | "pending" | "resolved" | "closed"
  lastVisitorMessageAt: string | null
  lastAgentMessageAt: string | null
  lastVisitorReadAt: string | null
  lastAgentReadAt: string | null
  resolvedAt: string | null
  visitorFeedback?: {
    rating: number | null
    comment: string
    submittedAt: string | null
  }
}

type Phase = "loading" | "unavailable" | "prechat" | "chat" | "ended"

const MESSAGE_MAX_LENGTH = 4000
const MUTE_STORAGE_KEY = "inboundr-support-muted"
const THEME_STORAGE_KEY = "inboundr-support-theme"

type Theme = "light" | "dark"

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

function ErrorNotice({ message, className }: { message: string; className?: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className={`flex items-start gap-2.5 rounded-2xl border border-red-200/80 bg-red-50/90 px-3.5 py-3 text-sm leading-relaxed text-red-700 shadow-sm shadow-red-900/5 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:shadow-none ${className ?? ""}`}
    >
      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
        <AlertCircleIcon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">{message}</span>
    </motion.div>
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

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === "light" || stored === "dark") return stored
    } catch {
      // Ignore storage access failures.
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage access failures.
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((value) => (value === "dark" ? "light" : "dark")), [])

  return { theme, toggleTheme }
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
  const [feedbackComment, setFeedbackComment] = useState("")
  const [endingChat, setEndingChat] = useState(false)
  const [endPersisted, setEndPersisted] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const { muted, toggleMuted, playConnected, playReceived } = useSupportSounds()
  const { theme, toggleTheme } = useTheme()

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
  const isResolved = ticket?.status === "resolved" || Boolean(ticket?.resolvedAt)

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
  }, [messages, streamingText, agentTyping, phase, isResolved])

  useEffect(() => {
    if (!isResolved) return
    setAgentTyping(false)
    setStreamingText(null)
    setSending(false)
    setDraft("")
    setFiles((current) => {
      current.forEach((item) => item.audioUrl && URL.revokeObjectURL(item.audioUrl))
      return []
    })
  }, [isResolved])

  useEffect(() => {
    const feedback = ticket?.visitorFeedback
    if (!feedback?.submittedAt) return
    setRating(feedback.rating ?? 0)
    setFeedbackComment(feedback.comment ?? "")
    setFeedbackSubmitted(true)
    setEndPersisted(true)
  }, [ticket?.visitorFeedback?.submittedAt])

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
    if (isResolved || (!text && files.length === 0) || sending || !sessionToken) return

    setDraft("")
    setSending(true)
    setStreamingText("")
    setError(null)

    try {
      const attachments = await Promise.all(files.map((item) => uploadAttachment(item.file, sessionToken)))
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "visitor_message", text, attachments }))
        files.forEach((item) => item.audioUrl && URL.revokeObjectURL(item.audioUrl))
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
    setFeedbackComment("")
    setEndingChat(false)
    setEndPersisted(false)
    setFeedbackSubmitted(false)
    setMenuOpen(false)
    setIssue("")
    setEmailCopy(false)
    setPhase("prechat")
  }

  async function persistSupportEnd(input: { rating?: number; feedbackComment?: string } = {}) {
    if (!sessionToken) return true
    const response = await fetch(`${apiBase}/session/${sessionToken}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error ?? "Failed to end chat")
    if (body?.ticket) setTicket(body.ticket)
    return true
  }

  async function endChat() {
    setMenuOpen(false)
    setEndingChat(true)
    setError(null)
    try {
      await persistSupportEnd()
      setEndPersisted(true)
      window.localStorage.removeItem(sessionStorageKey(organizationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end chat")
      setEndPersisted(false)
    } finally {
      setEndingChat(false)
    }
    socketRef.current?.close()
    if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
    setSocketReady(false)
    setAgentTyping(false)
    setStreamingText(null)
    setPhase("ended")
  }

  async function submitFeedback() {
    if (!rating && !feedbackComment.trim()) return
    setEndingChat(true)
    setError(null)
    try {
      await persistSupportEnd({ rating, feedbackComment: feedbackComment.trim() })
      setEndPersisted(true)
      setFeedbackSubmitted(true)
      window.localStorage.removeItem(sessionStorageKey(organizationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback")
    } finally {
      setEndingChat(false)
    }
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
    if (!fileList || isResolved) return
    const next = Array.from(fileList)
      .slice(0, Math.max(0, 5 - files.length))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file }))
    setFiles((current) => [...current, ...next].slice(0, 5))
  }

  function addVoice(file: File) {
    if (isResolved) return
    setFiles((current) => {
      if (current.length >= 5) return current
      return [...current, { id: crypto.randomUUID(), file, audioUrl: URL.createObjectURL(file) }]
    })
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.audioUrl) URL.revokeObjectURL(target.audioUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  function sendTyping(isTyping: boolean) {
    if (isResolved || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    if (visitorTypingRef.current === isTyping) return
    visitorTypingRef.current = isTyping
    socketRef.current.send(JSON.stringify({ type: "typing", isTyping }))
  }

  function handleDraftChange(value: string) {
    if (isResolved) return
    setDraft(value)
    sendTyping(Boolean(value.trim()))
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1200)
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (isResolved) return
      void sendMessage()
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f3f0] text-stone-400 dark:bg-[#0a0908] dark:text-stone-500">
        <LoaderIcon className="size-6 animate-spin" />
      </main>
    )
  }

  if (phase === "unavailable" || !organization) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f3f0] px-6 dark:bg-[#0a0908]">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <AlertCircleIcon className="mx-auto size-8 text-red-500" />
          <p className="mt-3 text-sm font-medium text-stone-700 dark:text-stone-300">{unavailableMessage}</p>
        </div>
      </main>
    )
  }

  const accent = organization.primaryColor || "#f5b400"
  const onAccent = readableTextColor(accent)
  const orgInitial = organization.name.charAt(0).toUpperCase()

  const headerAvatar =
    organization.logoUrl && !logoBroken ? (
      <img
        src={organization.logoUrl}
        alt={organization.name}
        onError={() => setLogoBroken(true)}
        className="size-9 shrink-0 rounded-xl bg-white object-contain ring-1 ring-stone-200 dark:ring-stone-700"
      />
    ) : (
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        {orgInitial}
      </div>
    )

  const supportAvatar =
    organization.logoUrl && !logoBroken ? (
      <img
        src={organization.logoUrl}
        alt=""
        className="size-7 shrink-0 rounded-full bg-white object-contain ring-1 ring-stone-200 dark:ring-stone-700"
      />
    ) : (
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: accent, color: onAccent }}
      >
        <HeadsetIcon className="size-3.5" />
      </div>
    )

  const iconButtonClasses =
    "flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={iconButtonClasses}
    >
      {theme === "dark" ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
    </button>
  )

  const renderHeader = (subtitle: React.ReactNode, showMenu: boolean) => (
    <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
      {headerAvatar}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[15px] font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {organization.name}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 flex items-center text-xs text-stone-500 dark:text-stone-400">{subtitle}</div>
        ) : null}
      </div>
      {themeToggle}
      {showMenu && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Chat options"
            className={iconButtonClasses}
          >
            <EllipsisVerticalIcon className="size-[18px]" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 text-stone-700 shadow-lg dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:shadow-black/40">
                <button
                  type="button"
                  onClick={toggleMuted}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition hover:bg-stone-50 dark:hover:bg-stone-700/60"
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
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
      <span
        className={`size-1.5 shrink-0 rounded-full ${
          isResolved ? "bg-stone-400" : socketReady ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <span className="truncate">{isResolved ? "Resolved" : socketReady ? "Online" : "Connecting…"}</span>
    </span>
  )

  const availabilityStatus = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span className="truncate">Online</span>
    </span>
  )

  const canSend = !isResolved && !sending && (draft.trim().length > 0 || files.length > 0)

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f3f0] dark:bg-[#0a0908] sm:p-6">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white dark:bg-stone-900 sm:h-[min(44rem,calc(100dvh-3rem))] sm:max-w-md sm:rounded-[20px] sm:ring-1 sm:ring-stone-900/5 sm:shadow-[0_24px_60px_-20px_rgba(28,25,23,0.35)] dark:sm:ring-white/10">
        {phase === "prechat" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {renderHeader(availabilityStatus, false)}

            <form
              onSubmit={startChat}
              className="thread-scroll flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-7"
            >
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <h2 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-stone-900 dark:text-stone-50">
                  How can we help?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                  Describe your issue and we&apos;ll connect you with the team. We usually reply within a few minutes.
                </p>
              </motion.div>

              <div className="grid gap-1.5">
                <Label htmlFor="support-issue">Message</Label>
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
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-3.5 py-3 text-left transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800/50"
              >
                <span
                  className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition ${
                    emailCopy ? "" : "border-stone-300 dark:border-stone-600"
                  }`}
                  style={emailCopy ? { backgroundColor: accent, borderColor: accent, color: onAccent } : undefined}
                >
                  {emailCopy && <CheckIcon className="size-3" strokeWidth={3.5} />}
                </span>
                <span className="text-sm text-stone-600 dark:text-stone-300">
                  Email me a copy of this conversation
                </span>
              </button>

              {error && <ErrorNotice message={error} />}

              <Button
                type="submit"
                disabled={starting || !issue.trim() || !name.trim() || !email.trim()}
                className="mt-1 h-11 w-full"
              >
                {starting && <LoaderIcon className="size-4 animate-spin" />}
                Start chat
              </Button>
              <p className="text-center text-xs text-stone-400 dark:text-stone-500">Powered by Inboundr</p>
            </form>
          </div>
        )}

        {phase === "chat" && (
          <>
            {renderHeader(connectionStatus, !isResolved)}

            <div
              className="thread-scroll flex-1 space-y-2 overflow-y-auto bg-white px-4 py-5 dark:bg-stone-900"
              aria-live="polite"
            >
              {messages.length === 0 && streamingText === null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-end gap-2"
                >
                  {supportAvatar}
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                    {visitorName ? `Hi ${visitorName.split(/\s+/)[0]}! ` : "Hi! "}
                    Thanks for reaching out to {organization.name}. Someone from the team will be with you shortly — feel
                    free to share any extra details below.
                  </div>
                </motion.div>
              )}

              {messages.map((message, index) => {
                if (message.authorType === "system") {
                  return (
                    <div key={message.id} className="flex justify-center py-1.5">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                        {message.bodyText}
                      </span>
                    </div>
                  )
                }

                const isVisitor = message.authorType === "visitor"
                const previous = messages[index - 1]
                const showAvatar =
                  !isVisitor &&
                  (!previous || previous.authorType === "visitor" || previous.authorType === "system")
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`flex items-end gap-2 ${isVisitor ? "justify-end" : "justify-start"}`}
                  >
                    {!isVisitor && (showAvatar ? supportAvatar : <div className="size-7 shrink-0" />)}
                    <div
                      title={formatFullTime(message.createdAt)}
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isVisitor
                          ? "rounded-br-md"
                          : "rounded-bl-md bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
                      }`}
                      style={isVisitor ? { backgroundColor: accent, color: onAccent } : undefined}
                    >
                      {message.authorType === "agent" && showAvatar && (
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                          Support Team
                        </p>
                      )}
                      {message.bodyText && <p>{message.bodyText}</p>}
                      {message.attachments?.length > 0 && (
                        <div className="mt-2 grid gap-2">
                          {message.attachments.map((attachment) =>
                            attachment.contentType.startsWith("audio/") ? (
                              <div key={attachment.key} className="py-0.5">
                                {attachment.url ? (
                                  <AudioPlayer
                                    src={attachment.url}
                                    surface={isVisitor ? "accent" : "neutral"}
                                    accent={accent}
                                    onAccent={onAccent}
                                  />
                                ) : (
                                  <span className="text-xs opacity-70">Audio unavailable</span>
                                )}
                              </div>
                            ) : (
                              <a
                                key={attachment.key}
                                href={attachment.url ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                                  isVisitor
                                    ? ""
                                    : "border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
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
                            )
                          )}
                        </div>
                      )}
                      <p
                        className={`mt-1 text-[11px] ${isVisitor ? "" : "text-stone-400 dark:text-stone-500"}`}
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

              {streamingText !== null && !isResolved && (
                <div className="flex items-end gap-2">
                  {supportAvatar}
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 dark:bg-stone-800 dark:text-stone-100">
                    {streamingText ? streamingText : <TypingDots />}
                  </div>
                </div>
              )}

              {agentTyping && !isResolved && (
                <div className="flex items-end gap-2">
                  {supportAvatar}
                  <div className="rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-3 dark:bg-stone-800">
                    <TypingDots />
                  </div>
                </div>
              )}

              {isResolved && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mx-auto mt-4 max-w-[21rem] rounded-3xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-center shadow-sm shadow-emerald-900/5 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:shadow-none"
                >
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <CircleCheckIcon className="size-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Conversation resolved
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                    This conversation has been marked resolved by the support team.
                  </p>

                  <div className="mt-4 border-t border-emerald-200/70 pt-4 dark:border-emerald-900/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      {feedbackSubmitted ? "Your rating" : "How was your experience?"}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = star <= (hoverRating || rating)
                        const inactiveColor = theme === "dark" ? "#57534e" : "#d6d3d1"
                        return (
                          <button
                            key={star}
                            type="button"
                            disabled={feedbackSubmitted}
                            onMouseEnter={() => !feedbackSubmitted && setHoverRating(star)}
                            onMouseLeave={() => !feedbackSubmitted && setHoverRating(0)}
                            onClick={() => !feedbackSubmitted && setRating(star)}
                            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                            className="p-1 transition-transform enabled:hover:scale-110 disabled:cursor-default"
                          >
                            <StarIcon
                              className="size-6"
                              style={{ color: active ? accent : inactiveColor, fill: active ? accent : "none" }}
                            />
                          </button>
                        )
                      })}
                    </div>

                    {feedbackSubmitted ? (
                      <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
                        Thanks for your feedback!
                      </p>
                    ) : (
                      <>
                        <textarea
                          value={feedbackComment}
                          onChange={(event) => setFeedbackComment(event.target.value)}
                          rows={3}
                          maxLength={2000}
                          placeholder="Anything else you'd like us to know?"
                          className="mt-3 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
                        />
                        <Button
                          type="button"
                          onClick={() => void submitFeedback()}
                          disabled={endingChat || (!rating && !feedbackComment.trim())}
                          className="mt-3 h-10 w-full"
                        >
                          {endingChat && <LoaderIcon className="size-4 animate-spin" />}
                          Save Feedback
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {error && <ErrorNotice message={error} />}
              <div ref={bottomRef} />
            </div>

            {isResolved ? (
              <div
                className="border-t border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <p className="text-center text-xs text-stone-500 dark:text-stone-400">
                  This conversation is closed. Start a new chat if you need more help.
                </p>
                <Button type="button" onClick={startNewChat} className="mt-3 h-10 w-full">
                  Start new chat
                </Button>
              </div>
            ) : (
              <form
                onSubmit={sendMessage}
                className="border-t border-stone-200 bg-white px-3 pt-3 dark:border-stone-800 dark:bg-stone-900"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                {files.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {files.map((item) =>
                      item.audioUrl ? (
                        <span
                          key={item.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl bg-stone-100 px-2.5 py-1.5 dark:bg-stone-800"
                        >
                          <AudioPlayer src={item.audioUrl} surface="neutral" accent={accent} onAccent={onAccent} />
                          <button
                            type="button"
                            aria-label="Remove voice message"
                            className="shrink-0 text-stone-400 transition hover:text-stone-700 dark:hover:text-stone-200"
                            onClick={() => removeFile(item.id)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      ) : (
                        <span
                          key={item.id}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                        >
                          <PaperclipIcon className="size-3 shrink-0" />
                          <span className="truncate">{item.file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${item.file.name}`}
                            className="shrink-0 text-stone-400 transition hover:text-stone-700 dark:hover:text-stone-200"
                            onClick={() => removeFile(item.id)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      )
                    )}
                  </div>
                )}
                <div className="rounded-2xl border border-stone-200 bg-white transition focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-900/5 dark:border-stone-700 dark:bg-stone-800/40 dark:focus-within:border-stone-500 dark:focus-within:ring-white/5">
                  <textarea
                    id="support-message-input"
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Type your message…"
                    maxLength={MESSAGE_MAX_LENGTH}
                    disabled={sending}
                    rows={1}
                    className="block max-h-32 min-h-[40px] w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 disabled:opacity-60 sm:text-sm dark:text-stone-100 dark:placeholder:text-stone-500"
                  />
                  <div className="flex items-center justify-between px-2.5 pb-2">
                    <div className="flex items-center gap-0.5">
                      <label className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700/60 dark:hover:text-stone-300">
                        <PaperclipIcon className="size-[18px]" />
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
                      <VoiceRecorder
                        onRecorded={addVoice}
                        disabled={sending || files.length >= 5}
                        accent={accent}
                        onAccent={onAccent}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!canSend}
                      title="Send"
                      aria-label="Send"
                      className={`flex size-8 items-center justify-center rounded-lg transition ${
                        canSend
                          ? "hover:brightness-95 active:scale-95"
                          : "cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500"
                      }`}
                      style={canSend ? { backgroundColor: accent, color: onAccent } : undefined}
                    >
                      {sending ? <LoaderIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}

        {phase === "ended" && (
          <>
            {renderHeader(<span className="truncate">Conversation closed</span>, false)}
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
              <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                Chat ended
              </h2>
              <p className="mt-1.5 max-w-xs text-sm text-stone-500 dark:text-stone-400">
                Thanks for chatting with {organization.name}.{" "}
                {emailCopy
                  ? endPersisted
                    ? "A copy of this conversation is on its way to your inbox."
                    : "We still need to save your transcript request."
                  : "We hope we were able to help."}
              </p>
              {error && <ErrorNotice message={error} className="mt-3 max-w-xs text-left" />}

              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                  {feedbackSubmitted ? "Your rating" : "How was your experience?"}
                </p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating)
                    const inactiveColor = theme === "dark" ? "#57534e" : "#d6d3d1"
                    return (
                      <button
                        key={star}
                        type="button"
                        disabled={feedbackSubmitted}
                        onMouseEnter={() => !feedbackSubmitted && setHoverRating(star)}
                        onMouseLeave={() => !feedbackSubmitted && setHoverRating(0)}
                        onClick={() => !feedbackSubmitted && setRating(star)}
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        className="p-1 transition-transform enabled:hover:scale-110 disabled:cursor-default"
                      >
                        <StarIcon
                          className="size-7"
                          style={{ color: active ? accent : inactiveColor, fill: active ? accent : "none" }}
                        />
                      </button>
                    )
                  })}
                </div>

                {feedbackSubmitted ? (
                  <>
                    {feedbackComment.trim() && (
                      <p className="mt-3 w-full max-w-xs whitespace-pre-wrap rounded-xl bg-stone-100 px-3 py-2 text-left text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        {feedbackComment.trim()}
                      </p>
                    )}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 text-sm text-stone-500 dark:text-stone-400"
                    >
                      Thanks for your feedback!
                    </motion.p>
                  </>
                ) : (
                  <>
                    <textarea
                      value={feedbackComment}
                      onChange={(event) => setFeedbackComment(event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Anything else you'd like us to know?"
                      className="mt-3 w-full max-w-xs resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                    />
                    <Button
                      type="button"
                      onClick={() => void submitFeedback()}
                      disabled={endingChat || (!rating && !feedbackComment.trim())}
                      className="mt-3 h-10 w-full max-w-xs"
                    >
                      {endingChat && <LoaderIcon className="size-4 animate-spin" />}
                      Save Feedback
                    </Button>
                  </>
                )}
              </div>

              {!endPersisted && (
                <Button
                  type="button"
                  onClick={() => void endChat()}
                  disabled={endingChat}
                  className="mt-5 h-11 w-full max-w-xs"
                >
                  {endingChat && <LoaderIcon className="size-4 animate-spin" />}
                  Retry Saving Chat
                </Button>
              )}

              <Button type="button" onClick={startNewChat} className="mt-4 h-11 w-full max-w-xs">
                Start new chat
              </Button>
              <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">Powered by Inboundr</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
