import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  CircleIcon,
  FileTextIcon,
  InboxIcon,
  PackageIcon,
  PlusIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

interface DailyStats {
  date: string
  emails: number
  rfqs: number
  nonRfqs: number
  products: number
}

interface StatsOverview {
  range: { from: string; to: string; bucket: "day" }
  totals: {
    emails: number
    rfqs: number
    nonRfqs: number
    products: number
    failed: number
  }
  daily: DailyStats[]
  byMember: Array<{ userId: string; name: string; email: string; emails: number; rfqs: number; products: number }>
  byGmailAccount: Array<{ id: string; emailAddress: string; emails: number; rfqs: number }>
  productBreakdown: Array<{ name: string; count: number; quantity: number }>
  matchQuality: { matched: number; ambiguous: number; noMatch: number }
}

interface ProductStats {
  totalProducts: number
  uniqueBrands: number
  avgUnitPrice: number
  recentlyAdded: number
}

interface RecentRFQ {
  _id: string
  subject: string
  from: string
  date: string
  status: string
}

const chartConfig = {
  rfqs: { label: "RFQs", color: "var(--chart-2)" },
  emails: { label: "Emails", color: "var(--chart-1)" },
} satisfies ChartConfig

function formatDayLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString([], { weekday: "short" })
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function MiniBarChart({ data, maxVal }: { data: number[]; maxVal: number }) {
  const safeMax = maxVal || 1
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[6px] rounded-sm bg-primary/70 transition-all duration-300"
          style={{ height: `${Math.max((v / safeMax) * 100, 4)}%` }}
        />
      ))}
    </div>
  )
}

function MatchRing({ percentage }: { percentage: number }) {
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (percentage / 100) * circumference
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
        <circle
          cx="34"
          cy="34"
          r="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/60"
        />
        <circle
          cx="34"
          cy="34"
          r="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-emerald-500 transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums">{percentage}%</span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-7" />
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-5" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
        <Skeleton className="h-[280px] rounded-2xl lg:col-span-4" />
        <Skeleton className="h-[280px] rounded-2xl lg:col-span-4" />
        <Skeleton className="h-[280px] rounded-2xl lg:col-span-4" />
      </div>
    </div>
  )
}

export function HomePage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [productStats, setProductStats] = useState<ProductStats | null>(null)
  const [recentRfqs, setRecentRfqs] = useState<RecentRFQ[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [statsRes, productsRes, rfqsRes] = await Promise.allSettled([
      fetch(`${API_ORIGIN}/api/v1/stats/overview?range=7d`, { credentials: "include" }),
      fetch(`${API_ORIGIN}/api/v1/products/stats`, { credentials: "include" }),
      fetch(`${API_ORIGIN}/api/v1/rfq?limit=5&page=1`, { credentials: "include" }),
    ])

    if (statsRes.status === "fulfilled" && statsRes.value.ok) {
      setStats(await statsRes.value.json())
    }
    if (productsRes.status === "fulfilled" && productsRes.value.ok) {
      setProductStats(await productsRes.value.json())
    }
    if (rfqsRes.status === "fulfilled" && rfqsRes.value.ok) {
      const data = await rfqsRes.value.json()
      setRecentRfqs(data.rfqs?.slice(0, 5) ?? [])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const userName = session?.user?.name?.split(" ")[0] ?? "there"
  const matchTotal = stats
    ? stats.matchQuality.matched + stats.matchQuality.ambiguous + stats.matchQuality.noMatch
    : 0
  const matchRate = matchTotal > 0 ? Math.round((stats!.matchQuality.matched / matchTotal) * 100) : 0

  const dailyRfqs = useMemo(() => stats?.daily.map((d) => d.rfqs) ?? [], [stats])
  const dailyMax = useMemo(() => Math.max(...dailyRfqs, 1), [dailyRfqs])

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <AppLayout>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-5 overflow-auto p-4 lg:px-6 lg:py-5">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Header */}
              <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-in fade-in-0 slide-in-from-bottom-1 duration-400">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {todayFormatted}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
                    {getGreeting()}, {userName}
                  </h1>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg">
                    <Link to="/rfq">
                      <FileTextIcon className="size-3.5" />
                      View RFQs
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-9 gap-1.5 rounded-lg">
                    <Link to="/products">
                      <PlusIcon className="size-3.5" />
                      Add Product
                    </Link>
                  </Button>
                </div>
              </section>

              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* RFQs */}
                <div
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
                  style={{ animationDelay: "80ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RFQs this week</p>
                      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                        {stats?.totals.rfqs ?? 0}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {stats?.totals.emails ?? 0} emails processed
                      </p>
                    </div>
                    <MiniBarChart data={dailyRfqs} maxVal={dailyMax} />
                  </div>
                </div>

                {/* Products Requested */}
                <div
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
                  style={{ animationDelay: "140ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Products Requested</p>
                      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                        {stats?.totals.products ?? 0}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Line items from RFQs
                      </p>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                      <PackageIcon className="size-5 text-primary" />
                    </div>
                  </div>
                </div>

                {/* Catalog Size */}
                <div
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
                  style={{ animationDelay: "200ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catalog Size</p>
                      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                        {productStats?.totalProducts?.toLocaleString("en-IN") ?? 0}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {productStats?.uniqueBrands ?? 0} brands · {productStats?.recentlyAdded ?? 0} new
                      </p>
                    </div>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-chart-4/10">
                      <BarChart3Icon className="size-5 text-chart-4" />
                    </div>
                  </div>
                </div>

                {/* Match Rate */}
                <div
                  className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
                  style={{ animationDelay: "260ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match Rate</p>
                      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                        {matchRate}%
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {stats?.matchQuality.matched ?? 0} of {matchTotal} matched
                      </p>
                    </div>
                    <MatchRing percentage={matchRate} />
                  </div>
                </div>
              </div>

              {/* Main Content: Chart + Recent RFQs */}
              <div className="grid gap-5 lg:grid-cols-12">
                {/* Activity Chart */}
                <section
                  className="rounded-2xl border bg-card p-5 lg:col-span-7 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "320ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold">Weekly Activity</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Inbound emails & RFQs over 7 days</p>
                    </div>
                    <Link
                      to="/stats"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Details
                      <ArrowUpRightIcon className="size-3" />
                    </Link>
                  </div>
                  {stats && stats.daily.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[240px] w-full">
                      <BarChart accessibilityLayer data={stats.daily} barCategoryGap="20%">
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tickFormatter={formatDayLabel}
                          className="text-[11px]"
                        />
                        <YAxis tickLine={false} axisLine={false} width={28} className="text-[11px]" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="emails" fill="var(--color-emails)" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="rfqs" fill="var(--color-rfqs)" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[240px] flex-col items-center justify-center rounded-xl border border-dashed">
                      <BarChart3Icon className="size-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm text-muted-foreground">Activity will appear here once emails are synced</p>
                    </div>
                  )}
                </section>

                {/* Recent RFQs — dark-themed card inspired by reference */}
                <section
                  className="flex flex-col rounded-2xl bg-foreground/[0.03] dark:bg-card border p-5 lg:col-span-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "380ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15">
                        <FileTextIcon className="size-3.5 text-primary" />
                      </div>
                      <h2 className="font-semibold">Recent RFQs</h2>
                    </div>
                    <Link
                      to="/rfq"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      All
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {recentRfqs.length > 0 ? (
                    <ul className="flex flex-1 flex-col gap-1">
                      {recentRfqs.map((rfq, i) => (
                        <li
                          key={rfq._id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
                        >
                          <span className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            rfq.status === "processed" || rfq.status === "replied"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : rfq.status === "failed"
                                ? "bg-red-500/15 text-red-500"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          )}>
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium leading-tight">
                              {rfq.subject || "No subject"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {rfq.from}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {formatRelativeDate(rfq.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-6">
                      <InboxIcon className="size-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm text-muted-foreground">No RFQs received yet</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">Connect a Gmail account to get started</p>
                    </div>
                  )}
                </section>
              </div>

              {/* Bottom Row */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
                {/* Top Requested Products */}
                <section
                  className="rounded-2xl border bg-card p-5 lg:col-span-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "440ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                        <TrendingUpIcon className="size-3.5 text-primary" />
                      </div>
                      <h2 className="font-semibold">Top Requested Products</h2>
                    </div>
                  </div>
                  {stats && stats.productBreakdown.length > 0 ? (
                    <ul className="space-y-1.5">
                      {stats.productBreakdown.slice(0, 5).map((product, i) => {
                        const maxCount = stats.productBreakdown[0]?.quantity ?? 1
                        const barWidth = Math.max((product.quantity / maxCount) * 100, 8)
                        return (
                          <li key={product.name} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{product.name}</p>
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {product.quantity}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed">
                      <PackageIcon className="size-6 text-muted-foreground/40" />
                      <p className="mt-2 text-sm text-muted-foreground">No product requests yet</p>
                    </div>
                  )}
                </section>

                {/* Match Quality Breakdown */}
                <section
                  className="rounded-2xl border bg-card p-5 lg:col-span-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "500ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
                      <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="font-semibold">Match Quality</h2>
                  </div>
                  <div className="flex flex-col items-center gap-4 py-2">
                    <MatchRing percentage={matchRate} />
                    <div className="w-full space-y-2.5">
                      <MatchRow label="Matched" count={stats?.matchQuality.matched ?? 0} total={matchTotal} color="bg-emerald-500" />
                      <MatchRow label="Ambiguous" count={stats?.matchQuality.ambiguous ?? 0} total={matchTotal} color="bg-amber-400" />
                      <MatchRow label="No Match" count={stats?.matchQuality.noMatch ?? 0} total={matchTotal} color="bg-red-400" />
                    </div>
                  </div>
                </section>

                {/* Quick Nav */}
                <section
                  className="rounded-2xl border bg-card p-5 lg:col-span-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "560ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-chart-2/10">
                      <ZapIcon className="size-3.5 text-chart-2" />
                    </div>
                    <h2 className="font-semibold">Quick Actions</h2>
                  </div>
                  <div className="grid gap-2">
                    <QuickActionLink to="/rfq" icon={FileTextIcon} label="Review RFQs" desc="Check pending quotes" />
                    <QuickActionLink to="/emails" icon={InboxIcon} label="Inbox" desc="View synced emails" />
                    <QuickActionLink to="/products" icon={PackageIcon} label="Products" desc="Manage your catalog" />
                    <QuickActionLink to="/stats" icon={BarChart3Icon} label="Analytics" desc="Detailed reports" />
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
    </AppLayout>
  )
}

function MatchRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("size-2 rounded-full", color)} />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">{count}</span>
      <span className="w-8 text-right text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  )
}

function QuickActionLink({ to, icon: Icon, label, desc }: { to: string; icon: typeof FileTextIcon; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 transition-colors group-hover:bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <ArrowRightIcon className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export default HomePage
