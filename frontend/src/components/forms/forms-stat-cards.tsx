import { useMemo } from "react"
import {
  CalendarDaysIcon,
  CircleDotIcon,
  InboxIcon,
  RadioIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  bucketRecentSubmissions,
  RECENT_STATS_DAYS,
  type ManagedForm,
} from "@/components/forms/types"

export function FormsStatCards({ forms }: { forms: ManagedForm[] }) {
  const stats = useMemo(() => {
    let totalResponses = 0
    let newResponses = 0
    const combined = new Array<number>(RECENT_STATS_DAYS).fill(0)

    for (const form of forms) {
      totalResponses += form.submissionCount ?? 0
      newResponses += form.newSubmissionCount ?? 0
      const buckets = bucketRecentSubmissions(form.recentSubmissionDates)
      for (let i = 0; i < RECENT_STATS_DAYS; i++) combined[i] += buckets[i]
    }

    const half = RECENT_STATS_DAYS / 2
    const previousWeek = combined.slice(0, half).reduce((sum, n) => sum + n, 0)
    const thisWeek = combined.slice(half).reduce((sum, n) => sum + n, 0)
    const liveForms = forms.filter((form) => form.status === "published").length

    return { totalResponses, newResponses, thisWeek, previousWeek, liveForms }
  }, [forms])

  const delta = stats.thisWeek - stats.previousWeek

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={<InboxIcon className="size-4" />}
        label="Total Responses"
        value={stats.totalResponses}
      />
      <StatCard
        icon={<CircleDotIcon className="size-4" />}
        label="Awaiting Review"
        value={stats.newResponses}
        highlight={stats.newResponses > 0}
      />
      <StatCard
        icon={<RadioIcon className="size-4" />}
        label="Live Forms"
        value={stats.liveForms}
        detail={`of ${forms.length} total`}
      />
      <StatCard
        icon={<CalendarDaysIcon className="size-4" />}
        label="This Week"
        value={stats.thisWeek}
        detail={
          stats.previousWeek > 0 || stats.thisWeek > 0 ? (
            <span
              className={cn(
                "font-medium",
                delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {/* Inline (non-flex) icon so the text keeps the row's baseline */}
              {delta > 0 ? (
                <TrendingUpIcon className="mr-1 inline size-3 align-[-1.5px]" />
              ) : delta < 0 ? (
                <TrendingDownIcon className="mr-1 inline size-3 align-[-1.5px]" />
              ) : null}
              {delta === 0 ? "same as last week" : `${delta > 0 ? "+" : ""}${delta} vs last week`}
            </span>
          ) : undefined
        }
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            highlight ? "bg-primary/15 text-primary" : "bg-muted",
          )}
        >
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </div>
    </div>
  )
}
