import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BarChart3Icon,
  InboxIcon,
  LoaderIcon,
  PackageIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const productChartConfig = {
  products: { label: "Products", color: "var(--chart-4)" },
} satisfies ChartConfig

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatDayLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" })
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string
  value: number
  helper: string
  icon: typeof InboxIcon
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString("en-IN")}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
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
  const filterMembers = useMemo(() => data?.byMember.filter((item) => item.emails || item.rfqs || item.products) ?? [], [data])
  const filterAccounts = useMemo(() => data?.byGmailAccount ?? [], [data])

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--header-height": "4rem",
          "--sidebar-width": "18rem",
        } as CSSProperties
      }
    >
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset>
        <SiteHeader
          actions={
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading || refreshing}>
              <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          }
        />
        <main className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
              <p className="text-sm text-muted-foreground">
                Organization activity across inbound mail, RFQs, and requested products.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex rounded-lg border bg-background p-1">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={range === option.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <select
                value={member}
                onChange={(event) => setMember(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All members</option>
                {filterMembers.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.email || item.name || item.userId}
                  </option>
                ))}
              </select>
              <select
                value={gmailAccount}
                onChange={(event) => setGmailAccount(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All mailboxes</option>
                {filterAccounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.emailAddress}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <StatsSkeleton />
          ) : error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-10 text-center">
              <AlertCircleIcon className="size-6 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
            </div>
          ) : !data || !hasData ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard title="Emails" value={data.totals.emails} helper={`${data.range.from} to ${data.range.to}`} icon={InboxIcon} />
                <StatCard title="RFQs" value={data.totals.rfqs} helper={`${rfqRate}% of received mail`} icon={BarChart3Icon} />
                <StatCard title="Non-RFQs" value={data.totals.nonRfqs} helper="Classified as not requiring a quote" icon={InboxIcon} />
                <StatCard title="Products" value={data.totals.products} helper="Requested RFQ line items" icon={PackageIcon} />
                <StatCard title="Failures" value={data.totals.failed} helper="RFQ processing errors" icon={AlertCircleIcon} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <section className="rounded-2xl border bg-card p-4 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold">Daily Mail and RFQs</h2>
                    <p className="text-sm text-muted-foreground">Inbound volume split by RFQ classification.</p>
                  </div>
                  <ChartContainer config={mailChartConfig} className="h-[300px] w-full">
                    <BarChart accessibilityLayer data={data.daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={formatDayLabel} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="emails" fill="var(--color-emails)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rfqs" fill="var(--color-rfqs)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="nonRfqs" fill="var(--color-nonRfqs)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold">Requested Products</h2>
                    <p className="text-sm text-muted-foreground">Daily line items extracted from RFQs.</p>
                  </div>
                  <ChartContainer config={productChartConfig} className="h-[300px] w-full">
                    <LineChart accessibilityLayer data={data.daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={formatDayLabel} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="products" stroke="var(--color-products)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <section className="rounded-2xl border bg-card p-4 shadow-xs xl:col-span-2">
                  <div className="mb-4 flex items-center gap-2">
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
                            <div className="text-xs text-muted-foreground">{item.userId}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.emails}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.rfqs}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.products}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>

                <section className="rounded-2xl border bg-card p-4 shadow-xs">
                  <h2 className="mb-4 text-base font-semibold">Match Quality</h2>
                  <div className="grid gap-3">
                    <StatRow label="Matched" value={data.matchQuality.matched} />
                    <StatRow label="Ambiguous" value={data.matchQuality.ambiguous} />
                    <StatRow label="No match" value={data.matchQuality.noMatch} />
                  </div>
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <BreakdownTable
                  title="Mailboxes"
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
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value.toLocaleString("en-IN")}</span>
    </div>
  )
}

function BreakdownTable({
  title,
  rows,
  firstLabel,
  secondLabel,
}: {
  title: string
  rows: Array<{ key: string; name: string; first: number; second: number }>
  firstLabel: string
  secondLabel: string
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
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
