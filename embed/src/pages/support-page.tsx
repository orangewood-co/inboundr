import { type FormEvent, useEffect, useRef, useState } from "react"
import { AlertCircleIcon, FileIcon, LoaderIcon, PaperclipIcon, RotateCcwIcon, SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ORIGIN } from "@/lib/env"

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

type Phase = "loading" | "unavailable" | "prechat" | "chat"

const MESSAGE_MAX_LENGTH = 4000

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

export default function SupportPage({ organizationId }: { organizationId: string }) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [organization, setOrganization] = useState<SupportOrganization | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState("Support chat is unavailable")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [starting, setStarting] = useState(false)

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

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const visitorTypingRef = useRef(false)
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, streamingText, phase])

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
      })

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as SocketEvent
        if (payload.type === "message.created") {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.message.id)) return current
            return [...current, payload.message]
          })
          if (payload.message.authorType === "agent") {
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
  }, [phase, sessionToken])

  async function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStarting(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, name, email }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.sessionToken) {
        throw new Error(body?.error ?? "Failed to start support chat")
      }
      window.localStorage.setItem(sessionStorageKey(organizationId), body.sessionToken)
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
    setSessionToken(null)
    setTicket(null)
    setMessages([])
    setDraft("")
    setFiles([])
    setError(null)
    setPhase("prechat")
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

  const header = (
    <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-5 py-4">
      {organization.logoUrl && !logoBroken ? (
        <img
          src={organization.logoUrl}
          alt={organization.name}
          onError={() => setLogoBroken(true)}
          className="size-9 rounded-lg object-contain"
        />
      ) : (
        <div
          className="flex size-9 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {organization.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-stone-900">{organization.name}</h1>
        <p className="flex items-center gap-1.5 text-xs text-stone-500">
          <span className={`size-1.5 rounded-full ${socketReady ? "bg-emerald-500" : "bg-amber-500"}`} />
          {socketReady ? "Support assistant" : "Connecting"}
        </p>
      </div>
      {phase === "chat" && (
        <button
          type="button"
          onClick={startNewChat}
          title="Start a new chat"
          className="flex size-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <RotateCcwIcon className="size-4" />
        </button>
      )}
    </header>
  )

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-stone-100 sm:p-6">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[min(44rem,calc(100dvh-3rem))] sm:max-w-md sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-sm">
        {header}

        {phase === "prechat" ? (
          <form onSubmit={startChat} className="flex flex-1 flex-col justify-center gap-4 px-6 py-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-900">Chat with us</h2>
              <p className="mt-1 text-sm text-stone-500">
                Tell us who you are and we&apos;ll get you connected.
              </p>
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
                autoFocus
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
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={starting || !name.trim() || !email.trim()} className="h-11">
              {starting && <LoaderIcon className="size-4 animate-spin" />}
              Start chat
            </Button>
            <p className="text-center text-xs text-stone-400">
              Powered by Inboundr
            </p>
          </form>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.authorType === "visitor" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    title={formatFullTime(message.createdAt)}
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.authorType === "visitor"
                        ? "rounded-br-md bg-stone-900 text-white"
                        : "rounded-bl-md bg-stone-100 text-stone-800"
                    }`}
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
                              message.authorType === "visitor"
                                ? "border-white/20 bg-white/10 text-white"
                                : "border-stone-200 bg-white text-stone-700"
                            } ${!attachment.url ? "pointer-events-none opacity-60" : ""}`}
                          >
                            <FileIcon className="size-3.5" />
                            <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
                            <span className="shrink-0 opacity-70">{fileSize(attachment.size)}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    <p className={`mt-1 text-[11px] ${message.authorType === "visitor" ? "text-white/60" : "text-stone-500"}`}>
                      {formatTime(message.createdAt)}
                      {message.authorType === "visitor" &&
                      latestVisitorMessage?.id === message.id &&
                      latestVisitorSeenBySupport
                        ? " · Seen by support"
                        : ""}
                    </p>
                  </div>
                </div>
              ))}

              {streamingText !== null && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-800">
                    {streamingText ? streamingText : <TypingDots />}
                  </div>
                </div>
              )}

              {agentTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm text-stone-500">
                    Support Team is typing...
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="border-t border-stone-200 bg-white p-3"
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
                        Remove
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
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
                <Input
                  id="support-message-input"
                  value={draft}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  placeholder="Type your message…"
                  maxLength={MESSAGE_MAX_LENGTH}
                  disabled={sending}
                  autoFocus
                  className="h-11 flex-1 rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={sending || (!draft.trim() && files.length === 0)}
                  title="Send"
                  className="size-11 shrink-0 rounded-xl p-0"
                  style={{ backgroundColor: accent }}
                >
                  {sending ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
