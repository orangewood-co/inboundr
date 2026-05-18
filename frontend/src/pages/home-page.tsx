import { type CSSProperties, useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  FileTextIcon,
  InboxIcon,
  PackageIcon,
  PlusIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[320px] rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[320px] rounded-2xl lg:col-span-2" />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
  delay,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: typeof InboxIcon
  accentClass: string
  delay: number
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", accentClass)}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

function RFQStatusDot({ status }: { status: string }) {
  const color =
    status === "processed" || status === "replied"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-400"
        : "bg-amber-400"
  return <span className={cn("inline-block size-2 rounded-full", color)} />
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

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--header-height": "4rem", "--sidebar-width": "18rem" } as CSSProperties}
    >
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-5">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Welcome Banner */}
              <section className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between animate-in fade-in-0 duration-500">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {getGreeting()}, {userName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Here&apos;s what&apos;s happening with your RFQs today.
                  </p>
                </div>
                <div className="mt-3 flex gap-2 sm:mt-0">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to="/rfq">
                      <FileTextIcon className="size-3.5" />
                      View RFQs
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to="/products">
                      <PlusIcon className="size-3.5" />
                      Add Product
                    </Link>
                  </Button>
                </div>
              </section>

              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="RFQs This Week"
                  value={stats?.totals.rfqs.toLocaleString("en-IN") ?? "0"}
                  subtitle={`${stats?.totals.emails.toLocaleString("en-IN") ?? "0"} total emails processed`}
                  icon={FileTextIcon}
                  accentClass="bg-primary/10 text-primary"
                  delay={100}
                />
                <StatCard
                  title="Products Requested"
                  value={stats?.totals.products.toLocaleString("en-IN") ?? "0"}
                  subtitle="Line items extracted from RFQs"
                  icon={PackageIcon}
                  accentClass="bg-chart-2/10 text-chart-2"
                  delay={150}
                />
                <StatCard
                  title="Catalog Size"
                  value={productStats?.totalProducts.toLocaleString("en-IN") ?? "0"}
                  subtitle={`${productStats?.uniqueBrands ?? 0} brands · ${productStats?.recentlyAdded ?? 0} added recently`}
                  icon={BarChart3Icon}
                  accentClass="bg-chart-4/10 text-chart-4"
                  delay={200}
                />
                <StatCard
                  title="Match Rate"
                  value={`${matchRate}%`}
                  subtitle={`${stats?.matchQuality.matched ?? 0} of ${matchTotal} products matched`}
                  icon={CheckCircle2Icon}
                  accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  delay={250}
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid gap-6 lg:grid-cols-5">
                {/* Activity Chart */}
                <section
                  className="rounded-2xl border bg-card p-5 lg:col-span-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "300ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Weekly Activity</h2>
                      <p className="text-xs text-muted-foreground">RFQs and emails over the past 7 days</p>
                    </div>
                    <Link
                      to="/stats"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      View all
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {stats && stats.daily.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <BarChart accessibilityLayer data={stats.daily} barGap={2}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={formatDayLabel}
                        />
                        <YAxis tickLine={false} axisLine={false} width={32} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="emails" fill="var(--color-emails)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="rfqs" fill="var(--color-rfqs)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20">
                      <p className="text-sm text-muted-foreground">No activity data yet</p>
                    </div>
                  )}
                </section>

                {/* Recent RFQs */}
                <section
                  className="flex flex-col rounded-2xl border bg-card p-5 lg:col-span-2 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "400ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Recent RFQs</h2>
                    <Link
                      to="/rfq"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      See all
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {recentRfqs.length > 0 ? (
                    <ul className="flex flex-1 flex-col divide-y">
                      {recentRfqs.map((rfq) => (
                        <li key={rfq._id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <RFQStatusDot status={rfq.status} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-tight">
                              {rfq.subject || "No subject"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {rfq.from}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelativeDate(rfq.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6">
                      <div className="text-center">
                        <InboxIcon className="mx-auto size-8 text-muted-foreground/50" />
                        <p className="mt-2 text-sm text-muted-foreground">No RFQs yet</p>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Bottom Row */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Product Catalog Card */}
                <section
                  className="rounded-2xl border bg-card p-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "500ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-chart-4/10">
                      <PackageIcon className="size-4 text-chart-4" />
                    </div>
                    <h2 className="text-base font-semibold">Product Catalog</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-2xl font-bold tabular-nums">{productStats?.totalProducts ?? 0}</p>
                      <p className="text-[11px] text-muted-foreground">Total Products</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-2xl font-bold tabular-nums">{productStats?.uniqueBrands ?? 0}</p>
                      <p className="text-[11px] text-muted-foreground">Brands</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-2xl font-bold tabular-nums">{productStats?.recentlyAdded ?? 0}</p>
                      <p className="text-[11px] text-muted-foreground">Recently Added</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-2xl font-bold tabular-nums">
                        {productStats?.avgUnitPrice ? `₹${Math.round(productStats.avgUnitPrice).toLocaleString("en-IN")}` : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Avg. Price</p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="mt-4 w-full gap-1.5">
                    <Link to="/products">
                      Manage catalog
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </Button>
                </section>

                {/* Top Requested Products */}
                <section
                  className="rounded-2xl border bg-card p-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "550ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUpIcon className="size-4 text-primary" />
                    </div>
                    <h2 className="text-base font-semibold">Top Requested</h2>
                  </div>
                  {stats && stats.productBreakdown.length > 0 ? (
                    <ul className="space-y-2.5">
                      {stats.productBreakdown.slice(0, 5).map((product, i) => (
                        <li key={product.name} className="flex items-center gap-3">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            ×{product.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/20">
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    </div>
                  )}
                </section>

                {/* Quick Actions */}
                <section
                  className="rounded-2xl border bg-card p-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: "600ms", animationFillMode: "backwards" } as CSSProperties}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-chart-2/10">
                      <SparklesIcon className="size-4 text-chart-2" />
                    </div>
                    <h2 className="text-base font-semibold">Quick Actions</h2>
                  </div>
                  <div className="grid gap-2">
                    <Button asChild variant="outline" size="sm" className="h-10 w-full justify-start gap-2.5">
                      <Link to="/rfq">
                        <FileTextIcon className="size-4 text-muted-foreground" />
                        Review pending RFQs
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-10 w-full justify-start gap-2.5">
                      <Link to="/emails">
                        <InboxIcon className="size-4 text-muted-foreground" />
                        Check inbox
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-10 w-full justify-start gap-2.5">
                      <Link to="/products">
                        <PackageIcon className="size-4 text-muted-foreground" />
                        Add products to catalog
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-10 w-full justify-start gap-2.5">
                      <Link to="/stats">
                        <BarChart3Icon className="size-4 text-muted-foreground" />
                        View detailed stats
                      </Link>
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default HomePage
