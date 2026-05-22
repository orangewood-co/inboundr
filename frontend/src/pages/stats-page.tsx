import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BarChart3Icon,
  CalendarIcon,
  CheckCircle2Icon,
  InboxIcon,
  PackageIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/stats`

type StatsRange = "7d" | "30d" | "90d"

interface DailyStats {
  date: string
  emails: number
  rfqs: number
  nonRfqs: number
  products: number
}

interface MemberStats {
  userId: string
  name: string
  email: string
  emails: number
  rfqs: number
  products: number
}

interface GmailAccountStats {
  id: string
  emailAddress: string
  emails: number
  rfqs: number
}

interface ProductStats {
  name: string
  count: number
  quantity: number
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
  byMember: MemberStats[]
  byGmailAccount: GmailAccountStats[]
  productBreakdown: ProductStats[]
  matchQuality: {
    matched: number
    ambiguous: number
    noMatch: number
  }
}

const rangeOptions: Array<{ value: StatsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
]

const mailChartConfig = {
  emails: { label: "Emails", color: "var(--chart-1)" },
  rfqs: { label: "RFQs", color: "var(--chart-2)" },
  nonRfqs: { label: "Non-RFQs", color: "var(--chart-3)" },
} satisfies ChartConfig

const trendChartConfig = {
  rfqs: { label: "RFQs", color: "var(--chart-2)" },
  products: { label: "Products", color: "var(--chart-4)" },
} satisfies ChartConfig

const DONUT_COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-5)"]

const matchChartConfig = {
  matched: { label: "Matched", color: "var(--chart-2)" },
  ambiguous: { label: "Ambiguous", color: "var(--chart-3)" },
  noMatch: { label: "No Match", color: "var(--chart-5)" },
} satisfies ChartConfig

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatDayLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatRangeLabel(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`)
  const t = new Date(`${to}T00:00:00Z`)
  const fmt = new Intl.DateTimeFormat([], { month: "short", day: "numeric", year: "numeric" })
  return `${fmt.format(f)} \u2013 ${fmt.format(t)}`
}

function StatCard({
  title,
  value,
  helper,
  tooltip,
  icon: Icon,
}: {
  title: string
  value: string
  helper: string
  tooltip?: string
  icon: typeof InboxIcon
}) {
  const card = (
    <div className="rounded-xl border bg-card p-5 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return card
}

function StatsSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[130px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[440px] rounded-xl" />
        <Skeleton className="h-[440px] rounded-xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[380px] rounded-xl" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <BarChart3Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">No stats yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Stats will appear after Gmail sync receives emails and RFQ classification has processed them.
        </p>
      </div>
    </div>
  )
}

export function StatsPage() {
  const [range, setRange] = useState<StatsRange>("30d")
  const [member, setMember] = useState("all")
  const [gmailAccount, setGmailAccount] = useState("all")
  const [data, setData] = useState<StatsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async () => {
    setError(null)
    const params = new URLSearchParams({ range, member, gmailAccount })
    const res = await fetch(`${API_BASE}/overview?${params.toString()}`, {
      credentials: "include",
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const nextData: StatsOverview = await res.json()
    setData(nextData)
  }, [gmailAccount, member, range])

  useEffect(() => {
    setLoading(true)
    fetchStats()
      .catch((err: Error) => setError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false))
  }, [fetchStats])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh stats")
    } finally {
      setRefreshing(false)
    }
  }

  const hasData = (data?.totals.emails ?? 0) > 0 || (data?.totals.rfqs ?? 0) > 0
  const rfqRate = data?.totals.emails ? Math.round((data.totals.rfqs / data.totals.emails) * 100) : 0
  const matchTotal = data ? data.matchQuality.matched + data.matchQuality.ambiguous + data.matchQuality.noMatch : 0
  const matchRate = matchTotal > 0 ? Math.round((data!.matchQuality.matched / matchTotal) * 100) : 0
  const filterMembers = useMemo(() => data?.byMember.filter((item) => item.emails || item.rfqs || item.products) ?? [], [data])
  const filterAccounts = useMemo(() => data?.byGmailAccount ?? [], [data])

  const donutData = useMemo(() => {
    if (!data) return []
    return [
      { name: "Matched", value: data.matchQuality.matched },
      { name: "Ambiguous", value: data.matchQuality.ambiguous },
      { name: "No Match", value: data.matchQuality.noMatch },
    ].filter((item) => item.value > 0)
  }, [data])

  return (
    <AppLayout>
        <SiteHeader
          actions={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading || refreshing}>
                  <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reload stats data</TooltipContent>
            </Tooltip>
          }
        />
        <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-5">
          {/* Header: title + inline filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Organization activity across inbound mail, RFQs, and requested products.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex rounded-lg border bg-muted/40 p-0.5">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={range === option.value ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Select
                value={member}
                onValueChange={setMember}
              >
                <SelectTrigger size="sm" className="w-full bg-background text-xs sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {filterMembers.map((item) => (
                    <SelectItem key={item.userId} value={item.userId}>
                      {item.email || item.name || item.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={gmailAccount}
                onValueChange={setGmailAccount}
              >
                <SelectTrigger size="sm" className="w-full bg-background text-xs sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All mailboxes</SelectItem>
                  {filterAccounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.emailAddress}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <StatsSkeleton />
          ) : error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border bg-card p-10 text-center">
              <AlertCircleIcon className="size-6 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
            </div>
          ) : !data || !hasData ? (
            <EmptyState />
          ) : (
            <div className="grid gap-6 animate-in fade-in-0 duration-500">
              {/* ── Stat Cards ── */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total Emails"
                  value={data.totals.emails.toLocaleString("en-IN")}
                  helper={`${data.totals.nonRfqs.toLocaleString("en-IN")} non-RFQs this period`}
                  tooltip="Total inbound emails received in the selected period"
                  icon={InboxIcon}
                />
                <StatCard
                  title="RFQs Received"
                  value={data.totals.rfqs.toLocaleString("en-IN")}
                  helper={`${rfqRate}% of received mail`}
                  tooltip="Emails classified as Requests for Quotation"
                  icon={BarChart3Icon}
                />
                <StatCard
                  title="Products Requested"
                  value={data.totals.products.toLocaleString("en-IN")}
                  helper="Line items extracted from RFQs"
                  tooltip="Individual product line items extracted from RFQ emails"
                  icon={PackageIcon}
                />
                <StatCard
                  title="Match Rate"
                  value={`${matchRate}%`}
                  helper={`${data.matchQuality.matched.toLocaleString("en-IN")} of ${matchTotal.toLocaleString("en-IN")} product lookups`}
                  tooltip="Percentage of requested products matched to your catalog"
                  icon={CheckCircle2Icon}
                />
              </div>

              {/* ── Charts Row ── */}
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Bar chart: daily mail & RFQs */}
                <section className="rounded-xl border bg-card p-5">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold">Daily Mail and RFQs</h2>
                    <p className="text-sm text-muted-foreground">Comparing inbound volume against RFQ classification.</p>
                  </div>
                  <ChartContainer config={mailChartConfig} className="h-[340px] w-full">
                    <BarChart accessibilityLayer data={data.daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={formatDayLabel} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="emails" fill="var(--color-emails)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rfqs" fill="var(--color-rfqs)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="nonRfqs" fill="var(--color-nonRfqs)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </section>

                {/* Dual-line chart: RFQ activity trends */}
                <section className="rounded-xl border bg-card p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">RFQ Activity Trends</h2>
                      <p className="text-sm text-muted-foreground">Track RFQs and product requests over time.</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <CalendarIcon className="size-3" />
                      {formatRangeLabel(data.range.from, data.range.to)}
                    </span>
                  </div>
                  <ChartContainer config={trendChartConfig} className="h-[340px] w-full">
                    <LineChart accessibilityLayer data={data.daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={formatDayLabel} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="rfqs" stroke="var(--color-rfqs)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="products" stroke="var(--color-products)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </section>
              </div>

              {/* ── Bottom Row: Donut + Member table ── */}
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Donut chart: match quality */}
                <section className="rounded-xl border bg-card p-5">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold">Match Quality Breakdown</h2>
                    <p className="text-sm text-muted-foreground">Product search accuracy across RFQ line items.</p>
                  </div>
                  {donutData.length > 0 ? (
                    <ChartContainer config={matchChartConfig} className="mx-auto h-[300px] max-w-md">
                      <PieChart accessibilityLayer>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          strokeWidth={2}
                          stroke="var(--background)"
                          label={({ name, percent }) => `${name}: ${Math.round((percent ?? 0) * 100)}%`}
                          labelLine={false}
                        >
                          {donutData.map((_, index) => (
                            <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center">
                      <p className="text-sm text-muted-foreground">No product matches recorded yet.</p>
                    </div>
                  )}
                </section>

                {/* Member breakdown table */}
                <section className="rounded-xl border bg-card p-5">
                  <div className="mb-5 flex items-center gap-2">
                    <UsersIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Member Breakdown</h2>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Emails</TableHead>
                        <TableHead className="text-right">RFQs</TableHead>
                        <TableHead className="text-right">Products</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byMember.map((item) => (
                        <TableRow key={item.userId}>
                          <TableCell>
                            <div className="font-medium">{item.email || item.name || item.userId}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.emails}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.rfqs}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.products}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </div>

              {/* ── Breakdown tables ── */}
              <div className="grid gap-6 xl:grid-cols-2">
                <BreakdownTable
                  title="Mailboxes"
                  subtitle="Email volume by connected Gmail account."
                  rows={data.byGmailAccount.map((item) => ({
                    key: item.id,
                    name: item.emailAddress,
                    first: item.emails,
                    second: item.rfqs,
                  }))}
                  firstLabel="Emails"
                  secondLabel="RFQs"
                />
                <BreakdownTable
                  title="Top Requested Products"
                  subtitle="Most frequently requested items across RFQs."
                  rows={data.productBreakdown.map((item) => ({
                    key: item.name,
                    name: item.name,
                    first: item.count,
                    second: item.quantity,
                  }))}
                  firstLabel="Mentions"
                  secondLabel="Quantity"
                />
              </div>
            </div>
          )}
        </main>
    </AppLayout>
  )
}

function BreakdownTable({
  title,
  subtitle,
  rows,
  firstLabel,
  secondLabel,
}: {
  title: string
  subtitle: string
  rows: Array<{ key: string; name: string; first: number; second: number }>
  firstLabel: string
  secondLabel: string
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">{firstLabel}</TableHead>
              <TableHead className="text-right">{secondLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="max-w-72 truncate font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.first.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">{row.second.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No data for this range.
        </p>
      )}
    </section>
  )
}

export default StatsPage
