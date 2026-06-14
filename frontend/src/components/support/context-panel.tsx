import { useEffect, useMemo, useState } from "react"
import { FileIcon, LoaderIcon, LockIcon, MicIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CopyableText } from "@/components/copy-button"
import { API_ORIGIN } from "@/lib/env"
import { cn, getAvatarColor } from "@/lib/utils"
import {
  fileSize,
  formatFullTime,
  formatRelativeTime,
  formatTime,
  initialsFromName,
  isAudioAttachment,
  isImageAttachment,
} from "./support-utils"
import type { Ticket, TicketAttachment, TicketMessage } from "./types"

const STATUS_STYLES: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  resolved: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  closed: "bg-muted text-muted-foreground",
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="border-b p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {count != null && count > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  )
}

function FileRow({ attachment }: { attachment: TicketAttachment }) {
  const Icon = isAudioAttachment(attachment) ? MicIcon : FileIcon
  return (
    <a
      href={attachment.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs transition-colors hover:bg-muted",
        !attachment.url && "pointer-events-none opacity-60"
      )}
    >
      {isImageAttachment(attachment) && attachment.url ? (
        <img src={attachment.url} alt="" className="size-8 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        {isAudioAttachment(attachment) ? "Voice message" : attachment.originalName}
      </span>
      <span className="shrink-0 text-muted-foreground tabular-nums">{fileSize(attachment.size)}</span>
    </a>
  )
}

function PastTickets({ ticket, onSelect }: { ticket: Ticket; onSelect: (id: string) => void }) {
  const [related, setRelated] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_ORIGIN}/api/v1/tickets/${ticket.id}/related`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setRelated(data?.tickets ?? [])
      })
      .catch(() => {
        if (!cancelled) setRelated([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticket.id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <LoaderIcon className="size-3.5 animate-spin" /> Loading...
      </div>
    )
  }

  if (related.length === 0) {
    return <p className="text-xs text-muted-foreground">No other conversations from this customer.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {related.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex flex-col gap-0.5 rounded-lg border bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium">
              #{item.ticketNumber} {item.subject || "Support chat"}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                STATUS_STYLES[item.status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {item.status}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(item.lastMessageAt)}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ContextPanel({
  ticket,
  messages,
  onSelectTicket,
}: {
  ticket: Ticket
  messages: TicketMessage[]
  onSelectTicket: (id: string) => void
}) {
  const avatar = getAvatarColor(ticket.requester.name)

  const attachments = useMemo(
    () => messages.flatMap((message) => message.attachments),
    [messages]
  )
  const notes = useMemo(() => messages.filter((message) => message.isInternal), [messages])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="flex flex-col items-center gap-2 border-b p-5 text-center">
        <Avatar className="size-14">
          <AvatarFallback className={cn("text-lg font-semibold", avatar.bg, avatar.text)}>
            {initialsFromName(ticket.requester.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{ticket.requester.name}</p>
          <CopyableText
            value={ticket.requester.email}
            label="Email copied"
            className="text-xs text-muted-foreground"
          >
            <span className="truncate">{ticket.requester.email}</span>
          </CopyableText>
        </div>
      </div>

      <Section title="Details">
        <div className="flex flex-col">
          <MetaRow label="Status">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                STATUS_STYLES[ticket.status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {ticket.status}
            </span>
          </MetaRow>
          <MetaRow label="Priority">
            <span className="capitalize">{ticket.priority}</span>
          </MetaRow>
          <MetaRow label="Channel">
            <span className="capitalize">{ticket.channel}</span>
          </MetaRow>
          <MetaRow label="Created">{formatFullTime(ticket.createdAt)}</MetaRow>
          <MetaRow label="Last activity">{formatRelativeTime(ticket.lastMessageAt)}</MetaRow>
          {ticket.resolvedAt && <MetaRow label="Resolved">{formatFullTime(ticket.resolvedAt)}</MetaRow>}
        </div>
      </Section>

      <Section title="Internal notes" count={notes.length}>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No notes yet. Switch the composer to Note to add a private note.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2.5 py-2"
              >
                <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  <LockIcon className="size-2.5" />
                  <span className="tabular-nums">{formatTime(note.createdAt)}</span>
                </div>
                <p className="text-xs whitespace-pre-wrap text-foreground/90">{note.bodyText}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Shared files" count={attachments.length}>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files shared in this conversation.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {attachments.map((attachment) => (
              <FileRow key={attachment.key} attachment={attachment} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Customer history">
        <PastTickets ticket={ticket} onSelect={onSelectTicket} />
      </Section>
    </div>
  )
}
