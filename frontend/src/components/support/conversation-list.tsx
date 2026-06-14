import { useMemo, useState } from "react"
import { InboxIcon, LockIcon, SearchIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, getAvatarColor } from "@/lib/utils"
import { formatRelativeTime, initialsFromName, isUnread } from "./support-utils"
import type { Ticket, TicketFilter } from "./types"

const TICKET_FILTERS: { value: TicketFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
]

function previewParts(ticket: Ticket): { prefix: string | null; text: string; note: boolean } {
  const note = Boolean(ticket.lastMessageIsInternal)
  const preview = ticket.lastMessagePreview?.trim()
  if (!preview) {
    return { prefix: null, text: ticket.subject || "New support chat", note: false }
  }
  let prefix: string | null = null
  if (note) prefix = "Note"
  else if (ticket.lastMessageAuthorType === "agent") prefix = "You"
  else if (ticket.lastMessageAuthorType === "bot") prefix = "Bot"
  return { prefix, text: preview, note }
}

function ConversationListItem({
  ticket,
  selected,
  onSelect,
}: {
  ticket: Ticket
  selected: boolean
  onSelect: (id: string) => void
}) {
  const unread = isUnread(ticket)
  const avatar = getAvatarColor(ticket.requester.name)
  const resolved = ticket.status === "resolved"
  const { prefix, text, note } = previewParts(ticket)

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        selected ? "bg-muted" : "hover:bg-muted/60",
        unread && !selected && "bg-primary/[0.04]"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="mt-0.5">
          <AvatarFallback className={cn("font-medium", avatar.bg, avatar.text)}>
            {initialsFromName(ticket.requester.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute right-0 bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
            resolved ? "bg-muted-foreground/40" : "bg-emerald-500"
          )}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}
          >
            {ticket.requester.name}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(ticket.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13px]",
              unread ? "text-foreground/80" : "text-muted-foreground"
            )}
          >
            {note && <LockIcon className="mr-1 inline size-3 -translate-y-px text-amber-500" />}
            {prefix && <span className="text-muted-foreground/70">{prefix}: </span>}
            {text}
          </p>
          {unread && (
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground/60 tabular-nums">#{ticket.ticketNumber}</p>
      </div>
    </button>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-xl p-2.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConversationList({
  filter,
  onFilterChange,
  tickets,
  loading,
  unreadCount,
  selectedTicketId,
  onSelect,
}: {
  filter: TicketFilter
  onFilterChange: (filter: TicketFilter) => void
  tickets: Ticket[]
  loading: boolean
  unreadCount: number
  selectedTicketId: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")

  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tickets
    return tickets.filter((ticket) => {
      const haystack = [
        ticket.requester.name,
        ticket.requester.email,
        ticket.subject,
        ticket.lastMessagePreview ?? "",
        `#${ticket.ticketNumber}`,
        String(ticket.ticketNumber),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search, tickets])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="space-y-2.5 border-b p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations..."
            className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-[3px]">
          {TICKET_FILTERS.map((item) => {
            const active = filter === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onFilterChange(item.value)}
                className={cn(
                  "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {item.value === "open" && unreadCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                      active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                    )}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <ListSkeleton />
        ) : visibleTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {search ? "No Matches Found" : "No Conversations Yet"}
            </p>
            <p className="mt-1 max-w-[15rem] text-sm text-muted-foreground">
              {search
                ? "Try a different name, email, or ticket number."
                : "New support chats from your customers will appear here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleTickets.map((ticket) => (
              <ConversationListItem
                key={ticket.id}
                ticket={ticket}
                selected={selectedTicketId === ticket.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
