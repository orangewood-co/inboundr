import { type FormEvent, useEffect, useRef, useState } from "react"
import { AlertCircleIcon, LoaderIcon, RotateCcwIcon, SendIcon } from "lucide-react"

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

export default function SupportPage({ organizationId }: { organizationId: string }) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [organization, setOrganization] = useState<SupportOrganization | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState("Support chat is unavailable")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [starting, setStarting] = useState(false)

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const apiBase = `${API_ORIGIN}/api/v1/public/support`

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
    if (!text || sending || !sessionToken) return

    const optimistic: SupportMessage = {
      id: `local-${Date.now()}`,
      authorType: "visitor",
      bodyText: text,
    }
    setMessages((current) => [...current, optimistic])
    setDraft("")
    setSending(true)
    setStreamingText("")
    setError(null)

    try {
      const response = await fetch(`${apiBase}/session/${sessionToken}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setMessages((current) => current.filter((message) => message.id !== optimistic.id))
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
          { id: `bot-${Date.now()}`, authorType: "bot", bodyText: reply.trim() },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setStreamingText(null)
      setSending(false)
      requestAnimationFrame(() => document.getElementById("support-message-input")?.focus())
    }
  }

  function startNewChat() {
    window.localStorage.removeItem(sessionStorageKey(organizationId))
    setSessionToken(null)
    setMessages([])
    setDraft("")
    setError(null)
    setPhase("prechat")
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
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Support assistant
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
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.authorType === "visitor"
                        ? "rounded-br-md bg-stone-900 text-white"
                        : "rounded-bl-md bg-stone-100 text-stone-800"
                    }`}
                  >
                    {message.bodyText}
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

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 border-t border-stone-200 bg-white p-3"
            >
              <Input
                id="support-message-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type your message…"
                maxLength={MESSAGE_MAX_LENGTH}
                disabled={sending}
                autoFocus
                className="h-11 flex-1 rounded-xl"
              />
              <Button
                type="submit"
                disabled={sending || !draft.trim()}
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
            </form>
          </>
        )}
      </div>
    </main>
  )
}
