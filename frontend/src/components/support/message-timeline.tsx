import { useEffect, useRef, useState } from "react"
import { CheckIcon, FileIcon, HeadphonesIcon, LoaderIcon, LockIcon, SparklesIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn, getAvatarColor } from "@/lib/utils"
import { AudioMessage } from "./audio-message"
import {
  authorLabel,
  dayKey,
  fileSize,
  formatDayDivider,
  formatFullTime,
  formatTime,
  initialsFromName,
  isAudioAttachment,
  isImageAttachment,
} from "./support-utils"
import type { SupportAiDraft, Ticket, TicketAttachment, TicketMessage } from "./types"

type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "group"
      key: string
      authorType: TicketMessage["authorType"]
      isNote: boolean
      messages: TicketMessage[]
    }

function buildRenderItems(messages: TicketMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let currentDay = ""
  let currentGroup: Extract<RenderItem, { kind: "group" }> | null = null
  let currentMergeKey: string | null = null

  for (const message of messages) {
    const day = dayKey(message.createdAt)
    if (day !== currentDay) {
      currentDay = day
      currentGroup = null
      currentMergeKey = null
      items.push({ kind: "divider", key: `divider-${day}`, label: formatDayDivider(message.createdAt) })
    }

    // Notes always stand alone; bubbles merge by consecutive author.
    const mergeKey = message.isInternal ? null : `author-${message.authorType}`
    if (currentGroup && mergeKey && currentMergeKey === mergeKey) {
      currentGroup.messages.push(message)
      continue
    }
    currentGroup = {
      kind: "group",
      key: `group-${message.id}`,
      authorType: message.authorType,
      isNote: message.isInternal,
      messages: [message],
    }
    currentMergeKey = mergeKey
    items.push(currentGroup)
  }

  return items
}

function AttachmentChip({ attachment, tone }: { attachment: TicketAttachment; tone: "agent" | "neutral" }) {
  if (isAudioAttachment(attachment)) {
    return <AudioMessage attachment={attachment} tone={tone} />
  }
  if (isImageAttachment(attachment) && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
        <img
          src={attachment.url}
          alt={attachment.originalName}
          className="max-h-64 w-full object-cover"
          loading="lazy"
        />
      </a>
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

function MessageAttachments({
  attachments,
  tone,
}: {
  attachments: TicketAttachment[]
  tone: "agent" | "neutral"
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-2 grid gap-2">
      {attachments.map((attachment) => (
        <AttachmentChip key={attachment.key} attachment={attachment} tone={tone} />
      ))}
    </div>
  )
}

function NoteGroup({ message }: { message: TicketMessage }) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <LockIcon className="size-3" />
          Internal note
          <span className="font-normal text-amber-700/60 dark:text-amber-300/60">
            · only your team can see this
          </span>
          <span className="ml-auto font-normal tabular-nums text-amber-700/60 dark:text-amber-300/60">
            {formatTime(message.createdAt)}
          </span>
        </div>
        {message.bodyText && (
          <p className="text-sm whitespace-pre-wrap text-foreground/90">{message.bodyText}</p>
        )}
        <MessageAttachments attachments={message.attachments} tone="neutral" />
      </div>
    </div>
  )
}

function BubbleGroup({
  group,
  requesterName,
  receiptForMessageId,
  receiptLabel,
}: {
  group: Extract<RenderItem, { kind: "group" }>
  requesterName: string
  receiptForMessageId: string | null
  receiptLabel: string
}) {
  const isAgent = group.authorType === "agent"
  const isBot = group.authorType === "bot"
  const isSystem = group.authorType === "system"
  const first = group.messages[0]
  const name = authorLabel(first, requesterName)
  const avatar = getAvatarColor(isAgent ? "You" : isBot ? "Assistant" : requesterName)

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {first.bodyText}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1", isAgent ? "items-end" : "items-start")}>
      <div
        className={cn(
          "flex items-center gap-2 px-1",
          isAgent ? "flex-row-reverse" : "flex-row"
        )}
      >
        <Avatar size="sm">
          <AvatarFallback className={cn("text-[10px] font-medium", avatar.bg, avatar.text)}>
            {isBot ? "AI" : isAgent ? <HeadphonesIcon className="size-3" /> : initialsFromName(requesterName)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium text-foreground/80">{name}</span>
        {isBot && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            Assistant
          </span>
        )}
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatTime(first.createdAt)}
        </span>
      </div>

      <div className={cn("flex max-w-[78%] flex-col gap-1", isAgent ? "items-end" : "items-start")}>
        {group.messages.map((message) => (
          <div key={message.id} className="w-full">
            <div
              title={formatFullTime(message.createdAt)}
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                isAgent
                  ? "rounded-tr-md border border-primary/15 bg-primary/10 text-foreground"
                  : isBot
                    ? "rounded-tl-md bg-accent text-accent-foreground"
                    : "rounded-tl-md border bg-muted text-foreground"
              )}
            >
              {message.bodyText && <p className="whitespace-pre-wrap">{message.bodyText}</p>}
              <MessageAttachments attachments={message.attachments} tone={isAgent ? "agent" : "neutral"} />
            </div>
            {receiptForMessageId === message.id && (
              <p
                className={cn(
                  "mt-1 px-1 text-[11px] text-muted-foreground",
                  isAgent ? "text-right" : "text-left"
                )}
              >
                {receiptLabel}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-xs text-muted-foreground">{name} is typing</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

function AiDraftCard({
  draft,
  approving,
  onApprove,
  onReject,
}: {
  draft: SupportAiDraft
  approving: boolean
  onApprove: (draftId: string, bodyText: string) => Promise<boolean>
  onReject: (draftId: string) => Promise<boolean>
}) {
  const [bodyText, setBodyText] = useState(draft.bodyText)
  const overLimit = bodyText.length > 4000
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
          <SparklesIcon className="size-3.5" />
          Pending AI draft
          <span className="font-normal text-muted-foreground">
            Edit before approving. Customers cannot see this yet.
          </span>
        </div>
        <textarea
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          rows={4}
          className={cn(
            "min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
            overLimit && "border-destructive focus-visible:border-destructive"
          )}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={cn("text-[11px] tabular-nums", overLimit ? "text-destructive" : "text-muted-foreground")}>
            {bodyText.length}/4000
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onReject(draft.id)}
              disabled={approving}
              className="gap-1.5"
            >
              <XIcon className="size-3.5" />
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onApprove(draft.id, bodyText)}
              disabled={approving || overLimit || !bodyText.trim()}
              className="gap-1.5"
            >
              {approving ? <LoaderIcon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
              Approve & Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MessageTimeline({
  ticket,
  messages,
  loading,
  visitorTyping,
  latestAgentMessage,
  latestVisitorMessage,
  latestAgentSeenByVisitor,
  latestVisitorSeenByAgent,
  aiDrafts,
  approvingDraft,
  onApproveDraft,
  onRejectDraft,
}: {
  ticket: Ticket
  messages: TicketMessage[]
  loading: boolean
  visitorTyping: boolean
  latestAgentMessage: TicketMessage | null
  latestVisitorMessage: TicketMessage | null
  latestAgentSeenByVisitor: boolean
  latestVisitorSeenByAgent: boolean
  aiDrafts: SupportAiDraft[]
  approvingDraft: boolean
  onApproveDraft: (draftId: string, bodyText: string) => Promise<boolean>
  onRejectDraft: (draftId: string) => Promise<boolean>
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, visitorTyping, ticket.id, aiDrafts.length])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <LoaderIcon className="size-5 animate-spin" />
      </div>
    )
  }

  const items = buildRenderItems(messages)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {items.map((item) =>
          item.kind === "divider" ? (
            <div key={item.key} className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : item.isNote ? (
            <NoteGroup key={item.key} message={item.messages[0]} />
          ) : (
            <BubbleGroup
              key={item.key}
              group={item}
              requesterName={ticket.requester.name}
              receiptForMessageId={
                latestAgentMessage && latestAgentSeenByVisitor
                  ? latestAgentMessage.id
                  : latestVisitorMessage && latestVisitorSeenByAgent
                    ? latestVisitorMessage.id
                    : null
              }
              receiptLabel={
                latestAgentMessage && latestAgentSeenByVisitor ? "Seen" : "Read"
              }
            />
          )
        )}
        {visitorTyping && <TypingIndicator name={ticket.requester.name} />}
        {aiDrafts.map((draft) => (
          <AiDraftCard
            key={draft.id}
            draft={draft}
            approving={approvingDraft}
            onApprove={onApproveDraft}
            onReject={onRejectDraft}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
