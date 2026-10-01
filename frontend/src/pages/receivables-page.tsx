import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  ChevronDownIcon,
  CircleDollarSignIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
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
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { invalidateInvoiceStats, invoiceStatsQueryOptions } from "@/lib/queries"
import { queryClient } from "@/lib/query-client"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const INVOICE_API = `${API_ORIGIN}/api/v1/invoices`

interface ReceivablesAging {
  current: number
  d1_15: number
  d16_30: number
  d31_45: number
  d45plus: number
}

interface ReceivablesCustomer {
  key: string
  customerId: string | null
  name: string
  company: string
  email: string
  outstanding: number
  overdue: number
  aging: ReceivablesAging
  invoiceCount: number
  oldestDueDate: string | null
}

interface ReceivablesResponse {
  summary: {
    outstanding: number
    overdue: number
    customerCount: number
    invoiceCount: number
  }
  customers: ReceivablesCustomer[]
}

interface InvoiceMonthlyPoint {
  key: string
  label: string
  invoiced: number
  collected: number
}

interface InvoiceStats {
  outstanding: number
  aging: ReceivablesAging
  monthly: InvoiceMonthlyPoint[]
}

interface OpenInvoice {
  _id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate: string | null
  totals: {
    grandTotal: number
    balanceDue: number
  }
}

const AGING_BUCKETS: Array<{ key: keyof ReceivablesAging; label: string; bar: string }> = [
  { key: "current", label: "Current", bar: "bg-emerald-500" },
  { key: "d1_15", label: "1-15 Days", bar: "bg-amber-400" },
  { key: "d16_30", label: "16-30 Days", bar: "bg-orange-500" },
  { key: "d31_45", label: "31-45 Days", bar: "bg-rose-500" },
  { key: "d45plus", label: "45+ Days", bar: "bg-red-700" },
]

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function labelStatus(status: string) {
  return status.replaceAll("_", " ")
}

export default function ReceivablesPage() {
  const [data, setData] = useState<ReceivablesResponse | null>(null)
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const fetchReceivables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${INVOICE_API}/receivables`, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch receivables")
      setData((await response.json()) as ReceivablesResponse)
      try {
        await invalidateInvoiceStats()
        setStats((await queryClient.fetchQuery(invoiceStatsQueryOptions)) as InvoiceStats)
      } catch {
        setStats(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch receivables")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReceivables()
  }, [fetchReceivables])

  const customers = data?.customers ?? []
  const summary = data?.summary

  return (
    <TooltipProvider>
      <AppLayout>
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <CircleDollarSignIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Receivables</h2>
              {!loading && summary && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                  {summary.customerCount.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => void fetchReceivables()} disabled={loading}>
                  <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>

          {/* Receivables analytics */}
          <div className="grid gap-4 border-b bg-muted/10 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <ReceivablesOverviewCard
              aging={stats?.aging}
              total={summary?.outstanding}
              loading={loading}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SummaryCard label="Overdue" value={summary?.overdue} loading={loading} destructive />
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customers with Dues</p>
                {loading ? (
                  <Skeleton className="mt-2 h-7 w-16" />
                ) : (
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{summary?.customerCount ?? 0}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {loading ? "" : `${summary?.invoiceCount ?? 0} open invoice${(summary?.invoiceCount ?? 0) === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <MonthlyChartCard stats={stats} loading={loading} className="lg:col-span-2" />
          </div>

          {/* Content */}
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold">Customer balances</h3>
              <p className="text-xs text-muted-foreground">Open amounts grouped by customer</p>
            </div>
            {!loading && summary && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {summary.invoiceCount} open invoice{summary.invoiceCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {error ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <AlertCircleIcon className="size-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchReceivables()}>Try Again</Button>
            </div>
          ) : loading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 px-5 py-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <CircleDollarSignIcon className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">Nothing Outstanding</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                No customers currently owe you money. New unpaid invoices will show up here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5">Customer</th>
                    <th className="px-5 py-2.5 text-right">Outstanding</th>
                    <th className="px-5 py-2.5 text-right">Overdue</th>
                    <th className="px-5 py-2.5">Aging</th>
                    <th className="px-5 py-2.5 text-right">Invoices</th>
                    <th className="px-5 py-2.5">Oldest Due</th>
                    <th className="px-5 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <CustomerRow
                      key={customer.key}
                      customer={customer}
                      expanded={expandedKey === customer.key}
                      onToggle={() =>
                        setExpandedKey((current) => (current === customer.key ? null : customer.key))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppLayout>
    </TooltipProvider>
  )
}

function ReceivablesOverviewCard({
  aging,
  total,
  loading,
}: {
  aging: ReceivablesAging | undefined
  total: number | undefined
  loading: boolean
}) {
  const segmentsTotal = aging
    ? AGING_BUCKETS.reduce((sum, bucket) => sum + aging[bucket.key], 0)
    : 0

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Receivables</p>
          <p className="mt-1 text-xs text-muted-foreground">Outstanding balance by age</p>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(total ?? 0)}</p>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
      ) : (
        <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {aging && segmentsTotal > 0
            ? AGING_BUCKETS.map((bucket) => {
                const value = aging[bucket.key]
                if (value <= 0) return null
                return (
                  <div
                    key={bucket.key}
                    className={bucket.bar}
                    style={{ width: `${(value / segmentsTotal) * 100}%` }}
                  />
                )
              })
            : null}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {AGING_BUCKETS.map((bucket) => (
          <div key={bucket.key} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("size-2 shrink-0 rounded-full", bucket.bar)} />
              <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {bucket.label}
              </span>
            </div>
            {loading ? (
              <Skeleton className="mt-1.5 h-4 w-16" />
            ) : (
              <p
                className={cn(
                  "mt-1 text-sm font-semibold tabular-nums",
                  bucket.key !== "current" && (aging?.[bucket.key] ?? 0) > 0 && "text-destructive"
                )}
              >
                {formatMoney(aging?.[bucket.key] ?? 0)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const chartConfig = {
  invoiced: { label: "Invoiced", color: "var(--chart-1)" },
  collected: { label: "Collected", color: "var(--chart-2)" },
} satisfies ChartConfig

function MonthlyChartCard({
  stats,
  loading,
  className,
}: {
  stats: InvoiceStats | null
  loading: boolean
  className?: string
}) {
  const monthly = stats?.monthly ?? []
  const totalInvoiced = monthly.reduce((sum, point) => sum + point.invoiced, 0)
  const totalCollected = monthly.reduce((sum, point) => sum + point.collected, 0)

  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoiced vs Collected</p>
          <p className="mt-1 text-xs text-muted-foreground">Monthly billing and payment activity</p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Invoiced</p>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-24" />
            ) : (
              <p className="text-base font-semibold tabular-nums" style={{ color: "var(--chart-1)" }}>
                {formatMoney(totalInvoiced)}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Collected</p>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-24" />
            ) : (
              <p className="text-base font-semibold tabular-nums" style={{ color: "var(--chart-2)" }}>
                {formatMoney(totalCollected)}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-56 w-full" />
      ) : monthly.length === 0 ? (
        <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No invoice activity to chart yet.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="mt-4 h-56 w-full">
          <BarChart data={monthly} barGap={4}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="invoiced" fill="var(--color-invoiced)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  loading,
  destructive,
}: {
  label: string
  value: number | undefined
  loading: boolean
  destructive?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", destructive && (value ?? 0) > 0 && "text-destructive")}>
          {formatMoney(value ?? 0)}
        </p>
      )}
    </div>
  )
}

function AgingBar({ aging }: { aging: ReceivablesAging }) {
  const total = AGING_BUCKETS.reduce((sum, bucket) => sum + aging[bucket.key], 0)
  if (total <= 0) return <div className="h-2 w-full max-w-44 rounded-full bg-muted" />

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 w-full max-w-44 overflow-hidden rounded-full bg-muted">
          {AGING_BUCKETS.map((bucket) => {
            const value = aging[bucket.key]
            if (value <= 0) return null
            return <div key={bucket.key} className={bucket.bar} style={{ width: `${(value / total) * 100}%` }} />
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="grid gap-1">
          {AGING_BUCKETS.map((bucket) =>
            aging[bucket.key] > 0 ? (
              <div key={bucket.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", bucket.bar)} />
                  {bucket.label}
                </span>
                <span className="tabular-nums">{formatMoney(aging[bucket.key])}</span>
              </div>
            ) : null
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function CustomerRow({
  customer,
  expanded,
  onToggle,
}: {
  customer: ReceivablesCustomer
  expanded: boolean
  onToggle: () => void
}) {
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null)

  useEffect(() => {
    if (!expanded || invoices !== null) return
    let cancelled = false

    const params = new URLSearchParams({ outstandingOnly: "1", limit: "50" })
    if (customer.customerId) params.set("customerId", customer.customerId)
    else if (customer.email) params.set("search", customer.email)
    else if (customer.company || customer.name) params.set("search", customer.company || customer.name)

    void fetch(`${INVOICE_API}?${params}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setInvoices((data?.invoices ?? []) as OpenInvoice[])
      })
      .catch(() => {
        if (!cancelled) setInvoices([])
      })

    return () => {
      cancelled = true
    }
  }, [expanded, invoices, customer])

  return (
    <>
      <tr
        className="cursor-pointer border-b transition-colors hover:bg-muted/30"
        onClick={onToggle}
      >
        <td className="px-5 py-3.5 align-top">
          <div className="font-medium">{customer.company || customer.name || "Walk-in customer"}</div>
          <div className="text-xs text-muted-foreground">{customer.email || customer.name || "-"}</div>
        </td>
        <td className="px-5 py-3.5 text-right align-top font-semibold tabular-nums">{formatMoney(customer.outstanding)}</td>
        <td className={cn("px-5 py-3.5 text-right align-top tabular-nums", customer.overdue > 0 && "font-medium text-destructive")}>
          {customer.overdue > 0 ? formatMoney(customer.overdue) : "-"}
        </td>
        <td className="px-5 py-3.5 align-middle">
          <AgingBar aging={customer.aging} />
        </td>
        <td className="px-5 py-3.5 text-right align-top tabular-nums">{customer.invoiceCount}</td>
        <td className="px-5 py-3.5 align-top">{formatDate(customer.oldestDueDate)}</td>
        <td className="px-3 py-3.5 align-top">
          <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={7} className="px-5 py-3">
            {invoices === null ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading open invoices…
              </div>
            ) : !invoices || invoices.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No open invoices found for this customer.</p>
            ) : (
              <div className="divide-y rounded-lg border bg-background">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice._id}
                    to="/invoices/$id"
                    params={{ id: invoice._id }}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{invoice.invoiceNumber}</span>
                      <Badge
                        variant={invoice.status === "overdue" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {labelStatus(invoice.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-xs text-muted-foreground">Due {formatDate(invoice.dueDate)}</span>
                      <span className="tabular-nums font-medium">{formatMoney(invoice.totals.balanceDue)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
