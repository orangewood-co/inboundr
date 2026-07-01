import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { HeadsetIcon, InboxIcon } from "lucide-react"

import { API_ORIGIN } from "@/lib/env"
import { formatListTimestamp } from "@/lib/format"

import {
  DashboardCard,
  RowChevron,
  WidgetAvatar,
  WidgetEmpty,
  WidgetError,
  WidgetRowsSkeleton,
  widgetRowClass,
} from "./dashboard-card"

interface SupportTicketRow {
  id: string
  ticketNumber: number
  subject: string
  requester: { name: string; email: string }
  lastMessageAt: string
  lastMessagePreview?: string | null
}

interface SupportListResponse {
  tickets: SupportTicketRow[]
  total: number
}

const SUPPORT_LIST_SEARCH = { status: "open" as const, q: "", tags: [] as string[], page: 1 }

function TicketRow({ ticket }: { ticket: SupportTicketRow }) {
  const requester = ticket.requester?.name || ticket.requester?.email || "Unknown"
  return (
    <Link to="/support/$ticketId" params={{ ticketId: ticket.id }} className={widgetRowClass}>
      <WidgetAvatar name={requester} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {ticket.subject || `Ticket #${ticket.ticketNumber}`}
        </p>
        <p className="truncate text-xs text-muted-foreground">{requester}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatListTimestamp(ticket.lastMessageAt)}
        </span>
        <RowChevron />
      </div>
    </Link>
  )
}

export function SupportActiveCard() {
  const [data, setData] = useState<SupportListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch(`${API_ORIGIN}/api/v1/tickets?status=open&limit=5`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as SupportListResponse
      })
      .then((body) => {
        if (active) setData(body)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load tickets")
      })
    return () => {
      active = false
    }
  }, [])

  const openCount = data?.total ?? 0

  return (
    <DashboardCard
      title="Open Tickets"
      icon={HeadsetIcon}
      to="/support"
      search={SUPPORT_LIST_SEARCH}
      headerAction={
        openCount > 0 ? (
          <Link
            to="/support"
            search={SUPPORT_LIST_SEARCH}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {openCount} open
          </Link>
        ) : undefined
      }
    >
      {error ? (
        <WidgetError message={error} />
      ) : data === null ? (
        <WidgetRowsSkeleton rows={4} />
      ) : data.tickets.length === 0 ? (
        <WidgetEmpty
          icon={InboxIcon}
          title="No open tickets"
          description="New support conversations will appear here."
        />
      ) : (
        <div className="flex flex-col">
          {data.tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
