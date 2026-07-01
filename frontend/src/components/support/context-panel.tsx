import { useEffect, useMemo, useState } from "react"
import { FileIcon, LoaderIcon, LockIcon, MicIcon, PlusIcon, StarIcon, UserRoundCheckIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CopyableText } from "@/components/copy-button"
import { API_ORIGIN } from "@/lib/env"
import { cn, getAvatarColor } from "@/lib/utils"
import { ChannelBadge } from "./channel"
import { useSupport } from "./support-provider"
import { TagChip } from "./tag-chip"
import { TagMultiSelect } from "./tag-select"
import {
  fileSize,
  formatFullTime,
  formatRelativeTime,
  formatTime,
  initialsFromName,
  isAudioAttachment,
  isImageAttachment,
} from "./support-utils"
import type { SupportCustomer, Ticket, TicketAttachment, TicketMessage } from "./types"

export const STATUS_STYLES: Record<string, string> = {
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

function CustomerMapping({ ticket }: { ticket: Ticket }) {
  const [candidates, setCandidates] = useState<SupportCustomer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [company, setCompany] = useState(ticket.requester.name)

  useEffect(() => {
    let cancelled = false
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""
    fetch(`${API_ORIGIN}/api/v1/tickets/${ticket.id}/customer-candidates${query}`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCandidates(data?.candidates ?? [])
      })
      .catch(() => {
        if (!cancelled) setCandidates([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, ticket.id])

  function handleSearchChange(value: string) {
    setLoading(true)
    setSearch(value)
  }

  async function link(customerId: string | null) {
    setBusyId(customerId ?? "unlink")
    try {
      await fetch(`${API_ORIGIN}/api/v1/tickets/${ticket.id}/customer`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function createCustomer() {
    setCreating(true)
    try {
      await fetch(`${API_ORIGIN}/api/v1/tickets/${ticket.id}/customer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim() || ticket.requester.name }),
      })
    } finally {
      setCreating(false)
    }
  }

  if (ticket.customer) {
    return (
      <div className="rounded-lg border bg-emerald-500/[0.06] p-3">
        <div className="flex items-start gap-2">
          <UserRoundCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{ticket.customer.company || ticket.customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ticket.customer.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-muted-foreground"
          disabled={busyId === "unlink"}
          onClick={() => void link(null)}
        >
          Unlink
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        value={search}
        onChange={(event) => handleSearchChange(event.target.value)}
        placeholder="Search customers..."
        className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <LoaderIcon className="size-3.5 animate-spin" /> Searching...
        </div>
      ) : candidates.length > 0 ? (
        <div className="space-y-1">
          {candidates.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => void link(customer.id)}
              disabled={busyId === customer.id}
              className="flex w-full flex-col rounded-lg border bg-background px-2.5 py-2 text-left text-xs transition hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium">{customer.company || customer.name}</span>
              <span className="text-muted-foreground">{customer.email}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No customer match found.</p>
      )}
      <div className="rounded-lg border border-dashed p-2">
        <p className="mb-1.5 text-xs font-medium">Create customer from requester</p>
        <input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company name"
          className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          disabled={creating}
          onClick={() => void createCustomer()}
        >
          {creating && <LoaderIcon className="animate-spin" />}
          Create and Link
        </Button>
      </div>
    </div>
  )
}

function TagsSection({ ticket }: { ticket: Ticket }) {
  const { ticketTags, updateTicketTags } = useSupport()
  const selectedIds = useMemo(() => ticket.tags.map((tag) => tag.id), [ticket.tags])

  async function toggle(tagId: string, selected: boolean) {
    const next = selected
      ? [...new Set([...selectedIds, tagId])]
      : selectedIds.filter((id) => id !== tagId)
    await updateTicketTags(ticket.id, next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ticket.tags.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={() => void toggle(tag.id, false)} />
      ))}
      <TagMultiSelect
        tags={ticketTags}
        selectedIds={selectedIds}
        onToggle={(tagId, selected) => void toggle(tagId, selected)}
        emptyLabel="No tags yet. Create them in Settings."
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon className="size-2.5" />
            {ticket.tags.length === 0 ? "Add tags" : "Add"}
          </button>
        }
      />
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
            <ChannelBadge channel={ticket.channel} />
          </MetaRow>
          {ticket.requester.phoneNumber && (
            <MetaRow label="Phone">
              <CopyableText
                value={ticket.requester.phoneNumber}
                label="Phone number copied"
                className="font-medium"
              >
                <span className="truncate">{ticket.requester.phoneNumber}</span>
              </CopyableText>
            </MetaRow>
          )}
          <MetaRow label="Created">{formatFullTime(ticket.createdAt)}</MetaRow>
          <MetaRow label="Last activity">{formatRelativeTime(ticket.lastMessageAt)}</MetaRow>
          {ticket.visitorEndedAt && <MetaRow label="Visitor ended">{formatFullTime(ticket.visitorEndedAt)}</MetaRow>}
          {ticket.resolvedAt && <MetaRow label="Resolved">{formatFullTime(ticket.resolvedAt)}</MetaRow>}
        </div>
      </Section>

      <Section title="Tags" count={ticket.tags.length}>
        <TagsSection ticket={ticket} />
      </Section>

      <Section title="Initial issue">
        {ticket.initialIssue ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.initialIssue}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No initial issue was provided.</p>
        )}
      </Section>

      <Section title="Visitor feedback">
        {ticket.visitorFeedback?.rating || ticket.visitorFeedback?.comment ? (
          <div className="space-y-2">
            {ticket.visitorFeedback.rating && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <StarIcon
                    key={index}
                    className={cn(
                      "size-4",
                      index < (ticket.visitorFeedback.rating ?? 0)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
            )}
            {ticket.visitorFeedback.comment && (
              <p className="rounded-lg border bg-muted/30 p-2 text-sm whitespace-pre-wrap">
                {ticket.visitorFeedback.comment}
              </p>
            )}
            {ticket.visitorFeedback.submittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted {formatRelativeTime(ticket.visitorFeedback.submittedAt)}
              </p>
            )}
          </div>
        ) : ticket.visitorEndedAt ? (
          <p className="text-xs text-muted-foreground">The visitor ended without leaving feedback.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Feedback appears here after the visitor ends the chat.</p>
        )}
      </Section>

      <Section title="Transcript email">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Requested: {ticket.emailTranscriptRequested ? "Yes" : "No"}</p>
          <p>
            Transcript sent:{" "}
            {ticket.transcriptEmailSentAt ? formatFullTime(ticket.transcriptEmailSentAt) : "Not sent"}
          </p>
          <p>
            Resolution sent:{" "}
            {ticket.resolvedEmailSentAt ? formatFullTime(ticket.resolvedEmailSentAt) : "Not sent"}
          </p>
        </div>
      </Section>

      <Section title="Customer match">
        <CustomerMapping key={ticket.id} ticket={ticket} />
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
        <PastTickets key={ticket.id} ticket={ticket} onSelect={onSelectTicket} />
      </Section>
    </div>
  )
}
