import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileTextIcon } from "lucide-react"

import { API_ORIGIN } from "@/lib/env"
import { formatListTimestamp, formatNumber } from "@/lib/format"

import {
  DashboardCard,
  RowChevron,
  WidgetAvatar,
  WidgetEmpty,
  WidgetError,
  WidgetRowsSkeleton,
  widgetRowClass,
} from "./dashboard-card"

interface RfqRow {
  _id: string
  emailId: { subject: string; from: string; date: string } | null
  customer: { name: string; company: string } | null
  errorMessage: string | null
  isProcessed: boolean
}

interface StatsOverview {
  totals: { rfqs: number; products: number }
}

function senderLabel(rfq: RfqRow) {
  if (rfq.customer?.company) return rfq.customer.company
  if (rfq.customer?.name) return rfq.customer.name
  return rfq.emailId?.from || "Unknown sender"
}

function RfqRowItem({ rfq }: { rfq: RfqRow }) {
  const sender = senderLabel(rfq)
  return (
    <Link to="/rfq" search={{ rfq: rfq._id }} className={widgetRowClass}>
      <WidgetAvatar name={sender} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{rfq.emailId?.subject || "(no subject)"}</p>
        <p className="truncate text-xs text-muted-foreground">{sender}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {rfq.emailId?.date ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatListTimestamp(rfq.emailId.date)}
          </span>
        ) : null}
        <RowChevron />
      </div>
    </Link>
  )
}

export function RfqActiveCard() {
  const [rfqs, setRfqs] = useState<RfqRow[] | null>(null)
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch(`${API_ORIGIN}/api/v1/rfq?limit=5`, { credentials: "include" }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { rfqs: RfqRow[] }
      }),
      fetch(`${API_ORIGIN}/api/v1/stats/overview?range=7d`, { credentials: "include" })
        .then((res) => (res.ok ? (res.json() as Promise<StatsOverview>) : null))
        .catch(() => null),
    ])
      .then(([list, overview]) => {
        if (!active) return
        setRfqs(list.rfqs)
        setStats(overview)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load RFQs")
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <DashboardCard
      title="Recent RFQs"
      icon={FileTextIcon}
      to="/rfq"
      headerAction={
        stats ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatNumber(stats.totals.rfqs)} this week
          </span>
        ) : undefined
      }
    >
      {error ? (
        <WidgetError message={error} />
      ) : rfqs === null ? (
        <WidgetRowsSkeleton rows={4} />
      ) : rfqs.length === 0 ? (
        <WidgetEmpty
          icon={FileTextIcon}
          title="No RFQs yet"
          description="Incoming requests for quotes will appear here."
        />
      ) : (
        <div className="flex flex-col">
          {rfqs.map((rfq) => (
            <RfqRowItem key={rfq._id} rfq={rfq} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
