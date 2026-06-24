import { useState } from "react"
import { SendIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import type { FeedbackMessage, FeedbackStatus } from "@/lib/feedback"

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
}

const STATUS_VARIANTS: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}

export function FeedbackMessageList({ messages }: { messages: FeedbackMessage[] }) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isAdmin = message.authorType === "admin"
        return (
          <div
            key={message._id}
            className={cn("flex", isAdmin ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                isAdmin
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center gap-2 text-xs",
                  isAdmin ? "text-muted-foreground" : "text-primary-foreground/80"
                )}
              >
                <span className="font-medium">
                  {isAdmin ? message.authorName || "Inboundr Team" : "You"}
                </span>
                <span>·</span>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FeedbackReplyComposer({
  onSend,
  placeholder = "Write a reply...",
  buttonLabel = "Send Reply",
}: {
  onSend: (message: string) => Promise<void>
  placeholder?: string
  buttonLabel?: string
}) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    if (!value.trim()) return

    setSending(true)
    try {
      await onSend(value.trim())
      setValue("")
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-2">
      <textarea
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        placeholder={placeholder}
        maxLength={5000}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={sending || !value.trim()}>
          {sending ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-2 size-4" />}
          {buttonLabel}
        </Button>
      </div>
    </form>
  )
}
