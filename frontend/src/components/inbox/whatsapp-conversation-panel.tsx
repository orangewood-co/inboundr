import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertCircleIcon,
  CheckCheckIcon,
  CheckIcon,
  FileIcon,
  FileTextIcon,
  LoaderIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AudioMessage } from "@/components/support/audio-message"
import { WhatsAppIcon } from "@/components/support/channel"
import {
  dayKey,
  fileSize,
  formatDayDivider,
  formatFullTime,
  formatTime,
  initialsFromName,
  isAudioAttachment,
  isImageAttachment,
  isVideoAttachment,
} from "@/components/support/support-utils"
import type { TicketAttachment } from "@/components/support/types"
import { CopyableText } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { API_ORIGIN } from "@/lib/env"
import { queryClient } from "@/lib/query-client"
import { cn, getAvatarColor } from "@/lib/utils"

const INBOX_API = `${API_ORIGIN}/api/v1/inbox`
const POLL_INTERVAL_MS = 10_000
const MESSAGE_MAX_LENGTH = 4096

type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed"

export interface WhatsAppMessage {
  _id: string
  direction: "inbound" | "outbound"
  type: string
  bodyText: string
  attachments: TicketAttachment[]
  sentAt: string
  authorUserId: string | null
  deliveryStatus: DeliveryStatus | null
  deliveryError: string | null
  rfqId: string | null
}

export interface WhatsAppConversationDetail {
  conversation: {
    _id: string
    from: string
    participantName: string | null
    phoneNumber: string
    snippet: string | null
    date: string
    status: "processing" | "processed" | "failed"
    threadCount: number
    rfqId: string | null
    isRFQ: boolean | null
    classificationReason: string | null
    rfqErrorMessage: string | null
    lastInboundAt: string | null
    windowOpen: boolean
    windowClosesAt: string | null
    rfq: {
      _id: string
      isProcessed: boolean
      errorMessage: string | null
      workflowStatus: "new" | "draft" | "processed"
      isArchived: boolean
      productCount: number
      quoteSent: boolean
    } | null
  }
  messages: WhatsAppMessage[]
}

function conversationQueryOptions(conversationId: string) {
  return {
    queryKey: ["inbox", "conversation", conversationId] as const,
    queryFn: async (): Promise<WhatsAppConversationDetail> => {
      const res = await fetch(`${INBOX_API}/conversations/${conversationId}`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || "Failed to load conversation")
      return data
    },
    refetchInterval: POLL_INTERVAL_MS,
  }
}

function hoursUntil(value: string | null): number | null {
  if (!value) return null
  return Math.max(0, (new Date(value).getTime() - Date.now()) / 3_600_000)
}

function AttachmentView({ attachment, outbound }: { attachment: TicketAttachment; outbound: boolean }) {
  if (isAudioAttachment(attachment)) {
    return <AudioMessage attachment={attachment} tone={outbound ? "agent" : "neutral"} />
  }
  if (isImageAttachment(attachment) && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
        <img src={attachment.url} alt={attachment.originalName} className="max-h-64 w-full object-cover" loading="lazy" />
      </a>
    )
  }
  if (isVideoAttachment(attachment) && attachment.url) {
    return (
      <video src={attachment.url} controls preload="metadata" className="max-h-64 w-full rounded-xl border bg-black" />
    )
  }
  return (
    <a
      href={attachment.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-xs text-foreground transition-colors hover:bg-background",
        !attachment.url && "pointer-events-none opacity-60"
      )}
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
      <span className="shrink-0 text-muted-foreground">{fileSize(attachment.size)}</span>
    </a>
  )
}

const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  pending: "Sending…",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not delivered",
}

function DeliveryLine({ message }: { message: WhatsAppMessage }) {
  const status = message.deliveryStatus
  if (!status) return null
  const failed = status === "failed"
  return (
    <p
      className={cn(
        "mt-1 flex items-center justify-end gap-1 px-1 text-[11px]",
        failed ? "text-destructive" : "text-muted-foreground"
      )}
      title={message.deliveryError ?? undefined}
    >
      {failed ? (
        <AlertCircleIcon className="size-3 shrink-0" />
      ) : status === "pending" ? (
        <LoaderIcon className="size-3 shrink-0 animate-spin" />
      ) : status === "sent" ? (
        <CheckIcon className="size-3 shrink-0" />
      ) : (
        <CheckCheckIcon className={cn("size-3 shrink-0", status === "read" && "text-sky-600 dark:text-sky-400")} />
      )}
      <span>
        {DELIVERY_LABEL[status]}
        {failed && message.deliveryError ? ` · ${message.deliveryError}` : ""}
      </span>
    </p>
  )
}

function MessageList({
  messages,
  customerName,
  className = "px-8 py-5",
}: {
  messages: WhatsAppMessage[]
  customerName: string
  className?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = messages[messages.length - 1]?._id

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [lastId])

  const items = useMemo(() => {
    const result: Array<{ kind: "divider"; key: string; label: string } | { kind: "message"; message: WhatsAppMessage }> = []
    let currentDay = ""
    for (const message of messages) {
      const day = dayKey(message.sentAt)
      if (day !== currentDay) {
        currentDay = day
        result.push({ kind: "divider", key: `divider-${day}`, label: formatDayDivider(message.sentAt) })
      }
      result.push({ kind: "message", message })
    }
    return result
  }, [messages])

  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No Messages Yet</p>
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => {
        if (item.kind === "divider") {
          return (
            <div key={item.key} className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border/60" />
              <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              <span className="h-px flex-1 bg-border/60" />
            </div>
          )
        }
        const { message } = item
        const outbound = message.direction === "outbound"
        return (
          <div key={message._id} className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
            <div className={cn("flex max-w-[78%] flex-col", outbound ? "items-end" : "items-start")}>
              <span className="mb-1 px-1 text-[11px] text-muted-foreground">
                {outbound ? "You" : customerName} · <span title={formatFullTime(message.sentAt)}>{formatTime(message.sentAt)}</span>
              </span>
              <div
                className={cn(
                  "w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  outbound
                    ? "rounded-tr-md border border-primary/15 bg-primary/10 text-foreground"
                    : "rounded-tl-md border bg-muted text-foreground"
                )}
              >
                {message.bodyText && <p className="whitespace-pre-wrap break-words">{message.bodyText}</p>}
                {message.attachments.length > 0 && (
                  <div className={cn("grid gap-2", message.bodyText && "mt-2")}>
                    {message.attachments.map((attachment) => (
                      <AttachmentView key={attachment.key} attachment={attachment} outbound={outbound} />
                    ))}
                  </div>
                )}
              </div>
              {outbound && <DeliveryLine message={message} />}
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}

function RFQStatusCard({
  detail,
  processing,
  onProcess,
  onOpenRFQ,
}: {
  detail: WhatsAppConversationDetail["conversation"]
  processing: boolean
  onProcess: () => void
  onOpenRFQ: (rfqId: string) => void
}) {
  const rfq = detail.rfq
  const pending = detail.status === "processing"
  const error = detail.rfqErrorMessage
  const rfqOpen = Boolean(rfq && !rfq.isArchived && rfq.workflowStatus !== "processed" && !rfq.quoteSent)

  let title: string
  let body: string
  if (error) {
    title = "RFQ processing failed"
    body = error
  } else if (pending) {
    title = "Reading the chat"
    body = "New messages are processed about a minute after the customer stops typing."
  } else if (rfq && rfqOpen) {
    title = rfq.isProcessed ? `RFQ with ${rfq.productCount} product${rfq.productCount === 1 ? "" : "s"}` : "Extracting RFQ"
    body = "Follow-up messages in this chat update the RFQ until the quote is sent."
  } else if (rfq) {
    title = rfq.quoteSent ? "Quote sent" : "RFQ closed"
    body = "New requests in this chat are checked again and can start a new RFQ."
  } else if (detail.isRFQ === false) {
    title = "No RFQ found"
    body = detail.classificationReason || "The latest messages did not look like a quotation request."
  } else {
    title = "Not processed yet"
    body = "Customer messages are checked for quotation requests automatically."
  }

  return (
    <div
      className={cn(
        "surface-inset flex items-start justify-between gap-3 rounded-xl border p-3",
        error ? "border-destructive/30" : "border-border/40"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {error ? (
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : pending ? (
          <Spinner className="mt-0.5 size-4 shrink-0" />
        ) : (
          <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className={cn("text-[13px] font-medium", error && "text-destructive")}>{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {rfq && (
          <Button variant="outline" size="sm" onClick={() => onOpenRFQ(rfq._id)}>
            <FileTextIcon className="mr-1.5 size-3.5" />
            Open RFQ
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onProcess} disabled={processing || pending}>
              {processing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon className="mr-1.5 size-3.5" />
              )}
              {rfqOpen ? "Reprocess" : "Create RFQ"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {rfqOpen
              ? "Re-read the whole chat and update the RFQ"
              : "Turn the customer's latest messages into an RFQ"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function Composer({
  conversation,
  onSent,
}: {
  conversation: WhatsAppConversationDetail["conversation"]
  onSent: (message: WhatsAppMessage) => void
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const hoursLeft = hoursUntil(conversation.windowClosesAt)

  async function submit() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const res = await fetch(`${INBOX_API}/conversations/${conversation._id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || "Failed to send message")
      setDraft("")
      onSent(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  if (!conversation.windowOpen) {
    return (
      <div className="shrink-0 border-t border-border/40 px-8 py-3">
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
          The customer last wrote more than 24 hours ago, so WhatsApp only allows replies after they
          message you again. Quotes can still be sent from the RFQ with the approved template.
        </p>
      </div>
    )
  }

  return (
    <div className="shrink-0 space-y-1.5 border-t border-border/40 px-8 py-3">
      <div className="rounded-xl border bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="Reply on WhatsApp..."
          aria-label="Reply on WhatsApp"
          rows={2}
          disabled={sending}
          className="max-h-40 min-h-10 w-full resize-none bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="text-[11px] text-muted-foreground">
            {hoursLeft != null && hoursLeft < 4
              ? `Reply window closes in ${hoursLeft < 1 ? "under an hour" : `${Math.floor(hoursLeft)}h`}`
              : "Enter to send · Shift+Enter for a new line"}
          </span>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={!draft.trim() || sending}>
            {sending ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-1.5 size-3.5" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Read-only chat transcript, for surfaces that show where an RFQ came from. */
export function WhatsAppChatTranscript({ conversationId }: { conversationId: string }) {
  const query = useQuery(conversationQueryOptions(conversationId))

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
        <Skeleton className="h-14 w-3/5 rounded-2xl" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <p className="text-[12px] text-destructive">
        {query.error instanceof Error ? query.error.message : "This chat could not be loaded"}
      </p>
    )
  }

  const { conversation, messages } = query.data
  return (
    <MessageList
      messages={messages}
      customerName={conversation.participantName || conversation.phoneNumber}
      className="py-1"
    />
  )
}

/**
 * Detail view for a WhatsApp chat on the RFQ number: the transcript, its RFQ
 * status, and a reply box (WhatsApp only allows free-form replies within 24
 * hours of the customer's last message).
 */
export function WhatsAppConversationPanel({
  conversationId,
  onClose,
  onOpenRFQ,
  onChanged,
}: {
  conversationId: string
  onClose: () => void
  onOpenRFQ: (rfqId: string) => void
  onChanged: () => void
}) {
  const options = conversationQueryOptions(conversationId)
  const query = useQuery(options)
  const [processing, setProcessing] = useState(false)
  const data = query.data

  function appendMessage(message: WhatsAppMessage) {
    queryClient.setQueryData<WhatsAppConversationDetail>(options.queryKey, (current) =>
      current ? { ...current, messages: [...current.messages, message] } : current
    )
    onChanged()
  }

  async function processRFQ() {
    setProcessing(true)
    try {
      const res = await fetch(`${INBOX_API}/conversations/${conversationId}/rfq`, {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) throw new Error(json?.error || "Failed to process this chat")
      toast.success(json.created ? "RFQ created from this chat" : "RFQ reprocessing started")
      await query.refetch()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process this chat")
    } finally {
      setProcessing(false)
    }
  }

  if (query.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-14 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
      </div>
    )
  }

  if (query.isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-[13px] font-medium text-destructive">This Chat Could Not Be Loaded</p>
        <p className="text-[12px] text-muted-foreground">
          {query.error instanceof Error ? query.error.message : "Something went wrong"}
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const { conversation, messages } = data
  const name = conversation.participantName || conversation.phoneNumber
  const colors = getAvatarColor(name)

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-300">
      <div className="shrink-0 space-y-4 px-8 pt-7 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold", colors.bg, colors.text)}>
              {initialsFromName(name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-heading text-lg font-semibold leading-snug tracking-tight">{name}</h1>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <WhatsAppIcon className="size-3" />
                  WhatsApp
                </span>
              </div>
              <CopyableText value={conversation.phoneNumber} label="Phone copied">
                <p className="truncate text-[11px] text-muted-foreground/70">{conversation.phoneNumber}</p>
              </CopyableText>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground/50 hover:text-foreground" onClick={onClose}>
                <XIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
        </div>
        <RFQStatusCard detail={conversation} processing={processing} onProcess={() => void processRFQ()} onOpenRFQ={onOpenRFQ} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/30">
        <MessageList messages={messages} customerName={name} />
      </div>

      <Composer conversation={conversation} onSent={appendMessage} />
    </div>
  )
}
