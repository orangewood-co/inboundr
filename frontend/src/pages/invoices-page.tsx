import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  DownloadIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { AppLayout } from "@/components/app-layout"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const INVOICE_API = `${API_ORIGIN}/api/v1/invoices`
const PAGE_LIMIT = 20

type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "written_off"

interface Invoice {
  _id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string | null
  paymentTerms: string
  customerSnapshot: {
    name: string
    company: string
    email: string
  }
  totals: {
    grandTotal: number
    paidTotal: number
    balanceDue: number
  }
}

interface InvoicesResponse {
  invoices: Invoice[]
  total: number
  page: number
  totalPages: number
}

interface InvoiceAging {
  current: number
  d1_15: number
  d16_30: number
  d31_45: number
  d45plus: number
}

interface InvoiceMonthlyPoint {
  key: string
  label: string
  invoiced: number
  collected: number
}

interface InvoiceStats {
  totalInvoiced: number
  outstanding: number
  overdue: number
  paidThisMonth: number
  aging: InvoiceAging
  monthly: InvoiceMonthlyPoint[]
  countByStatus: Record<string, number>
}

const statusOptions = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "written_off"]

function labelStatus(status: string) {
  return status.replaceAll("_", " ")
}

function statusVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default"
  if (status === "overdue" || status === "cancelled" || status === "written_off") return "destructive"
  if (status === "draft") return "outline"
  return "secondary"
}

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT), status })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const response = await fetch(`${INVOICE_API}?${params}`, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch invoices")
      const data = (await response.json()) as InvoicesResponse
      setInvoices(data.invoices)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch invoices")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, status])

  const fetchStats = useCallback(async () => {
    const response = await fetch(`${INVOICE_API}/stats`, { credentials: "include" })
    if (response.ok) setStats((await response.json()) as InvoiceStats)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    void fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  function toggleSelect(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === invoices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(invoices.map((i) => i._id)))
    }
  }

  async function bulkSend() {
    const drafts = invoices.filter((i) => selected.has(i._id) && i.status === "draft")
    if (drafts.length === 0) {
      toast.error("No draft invoices selected to send")
      return
    }
    setBulkLoading(true)
    let successCount = 0
    for (const invoice of drafts) {
      try {
        const response = await fetch(`${INVOICE_API}/${invoice._id}/send`, { method: "POST", credentials: "include" })
        if (response.ok) successCount++
      } catch { /* continue */ }
    }
    setBulkLoading(false)
    if (successCount === drafts.length) {
      toast.success(`Sent ${successCount} of ${drafts.length} invoices`)
    } else {
      toast.error(`Sent ${successCount} of ${drafts.length} invoices — ${drafts.length - successCount} failed`)
    }
    setSelected(new Set())
    void fetchInvoices()
    void fetchStats()
  }

  async function bulkCancel() {
    const cancellable = invoices.filter((i) => selected.has(i._id) && i.status !== "cancelled" && i.status !== "paid")
    if (cancellable.length === 0) {
      toast.error("No cancellable invoices selected")
      return
    }
    setBulkLoading(true)
    let successCount = 0
    for (const invoice of cancellable) {
      try {
        const response = await fetch(`${INVOICE_API}/${invoice._id}/cancel`, { method: "POST", credentials: "include" })
        if (response.ok) successCount++
      } catch { /* continue */ }
    }
    setBulkLoading(false)
    if (successCount === cancellable.length) {
      toast.success(`Cancelled ${successCount} of ${cancellable.length} invoices`)
    } else {
      toast.error(`Cancelled ${successCount} of ${cancellable.length} invoices — ${cancellable.length - successCount} failed`)
    }
    setSelected(new Set())
    void fetchInvoices()
    void fetchStats()
  }

  function exportCsv() {
    const header = ["Invoice", "Customer", "Status", "Issue date", "Due date", "Grand total", "Paid", "Balance"]
    const rows = invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customerSnapshot.company || invoice.customerSnapshot.name,
      invoice.status,
      formatDate(invoice.issueDate),
      formatDate(invoice.dueDate),
      invoice.totals.grandTotal,
      invoice.totals.paidTotal,
      invoice.totals.balanceDue,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "invoices.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      <AppLayout>
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Top bar */}
          <PageToolbar
            icon={ReceiptTextIcon}
            title="Invoices"
            count={loading ? null : total}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={invoices.length === 0}>
                  <DownloadIcon className="size-4" />
                  Export CSV
                </Button>
                <Button size="sm" asChild>
                  <Link to="/invoices/new" search={{ edit: undefined }}>
                    <PlusIcon className="size-4" />
                    New Invoice
                  </Link>
                </Button>
              </>
            }
          />

          {/* Stats */}
          <div className="grid gap-4 border-b p-4 lg:grid-cols-3">
            <ReceivablesCard stats={stats} className="lg:col-span-2" />
            <StatusSummaryCard stats={stats} />
            <MonthlyChartCard stats={stats} className="lg:col-span-3" />
          </div>

          {/* Filters + bulk actions */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="relative min-w-72 flex-1">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number, customer, PO..."
                className="pl-10"
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option} className="capitalize">
                    {option === "all" ? "All Invoices" : labelStatus(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => { void fetchInvoices(); void fetchStats() }} disabled={loading}>
                  <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>

            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                <Button variant="outline" size="sm" onClick={() => void bulkSend()} disabled={bulkLoading}>
                  Send Drafts
                </Button>
                <Button variant="outline" size="sm" onClick={() => void bulkCancel()} disabled={bulkLoading}>
                  Cancel
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {error ? (
            <ErrorState message={error} onRetry={() => void fetchInvoices()} />
          ) : loading ? (
            <ListSkeleton rows={8} columns={4} />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={ReceiptTextIcon}
              title="No Invoices Yet"
              description="Create your first invoice to start tracking payments and revenue."
              action={
                <Button size="sm" asChild>
                  <Link to="/invoices/new" search={{ edit: undefined }}>
                    <PlusIcon className="size-4" />
                    New Invoice
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 w-10">
                      <Checkbox
                        checked={invoices.length > 0 && selected.size === invoices.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-5 py-2.5">Invoice</th>
                    <th className="px-5 py-2.5">Customer</th>
                    <th className="px-5 py-2.5">Due</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                    <th className="px-5 py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice._id}
                      className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                      onClick={() => void navigate({ to: "/invoices/$id", params: { id: invoice._id } })}
                    >
                      <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(invoice._id)}
                          onCheckedChange={() => toggleSelect(invoice._id)}
                        />
                      </td>
                      <td className="px-5 py-3.5 align-top font-medium">
                        {invoice.invoiceNumber}
                        <div className="text-xs font-normal text-muted-foreground">Issued {formatDate(invoice.issueDate)}</div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="font-medium">{invoice.customerSnapshot.company || invoice.customerSnapshot.name || "Walk-in customer"}</div>
                        <div className="text-xs text-muted-foreground">{invoice.customerSnapshot.email || "-"}</div>
                      </td>
                      <td className="px-5 py-3.5 align-top">{formatDate(invoice.dueDate)}</td>
                      <td className="px-5 py-3.5 align-top">
                        <Badge variant={statusVariant(invoice.status)} className="capitalize">{labelStatus(invoice.status)}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right align-top font-medium">{formatMoney(invoice.totals.grandTotal)}</td>
                      <td className="px-5 py-3.5 text-right align-top">{formatMoney(invoice.totals.balanceDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of <span className="font-semibold text-foreground">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={page <= 1 || loading}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((c) => Math.min(totalPages, c + 1))} disabled={page >= totalPages || loading}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    </TooltipProvider>
  )
}

const AGING_BUCKETS: Array<{ key: keyof InvoiceAging; label: string; bar: string; dot: string }> = [
  { key: "current", label: "Current", bar: "bg-success", dot: "bg-success" },
  { key: "d1_15", label: "1-15 Days", bar: "bg-warning", dot: "bg-warning" },
  {
    key: "d16_30",
    label: "16-30 Days",
    bar: "bg-[color-mix(in_oklab,var(--warning)_50%,var(--destructive))]",
    dot: "bg-[color-mix(in_oklab,var(--warning)_50%,var(--destructive))]",
  },
  { key: "d31_45", label: "31-45 Days", bar: "bg-destructive/75", dot: "bg-destructive/75" },
  { key: "d45plus", label: "45+ Days", bar: "bg-destructive", dot: "bg-destructive" },
]

function ReceivablesCard({ stats, className }: { stats: InvoiceStats | null; className?: string }) {
  const aging = stats?.aging
  const total = stats?.outstanding ?? 0
  const segmentsTotal = aging
    ? aging.current + aging.d1_15 + aging.d16_30 + aging.d31_45 + aging.d45plus
    : 0

  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Receivables</p>
        {stats ? (
          <p className="text-lg font-semibold tabular-nums">{formatMoney(total)}</p>
        ) : (
          <Skeleton className="h-5 w-28" />
        )}
      </div>

      {stats ? (
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {segmentsTotal > 0 && aging ? (
            AGING_BUCKETS.map((bucket) => {
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
          ) : null}
        </div>
      ) : (
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {AGING_BUCKETS.map((bucket) => (
          <div key={bucket.key} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("size-2 shrink-0 rounded-full", bucket.dot)} />
              <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {bucket.label}
              </span>
            </div>
            {stats && aging ? (
              <p
                className={cn(
                  "mt-1 text-sm font-semibold tabular-nums",
                  bucket.key !== "current" && aging[bucket.key] > 0 && "text-destructive"
                )}
              >
                {formatMoney(aging[bucket.key])}
              </p>
            ) : (
              <Skeleton className="mt-1 h-4 w-16" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_SUMMARY: Array<{ key: InvoiceStatus; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "partially_paid", label: "Partially paid" },
  { key: "paid", label: "Paid" },
]

function StatusSummaryCard({ stats, className }: { stats: InvoiceStats | null; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">By Status</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {STATUS_SUMMARY.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <Badge variant={statusVariant(item.key)} className="capitalize">
              {item.label}
            </Badge>
            {stats ? (
              <span className="text-sm font-semibold tabular-nums">{stats.countByStatus[item.key] ?? 0}</span>
            ) : (
              <Skeleton className="h-4 w-6" />
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

function MonthlyChartCard({ stats, className }: { stats: InvoiceStats | null; className?: string }) {
  const monthly = stats?.monthly ?? []
  const totalInvoiced = monthly.reduce((sum, point) => sum + point.invoiced, 0)
  const totalCollected = monthly.reduce((sum, point) => sum + point.collected, 0)

  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoiced vs Collected</p>
        <div className="flex gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Invoiced</p>
            {stats ? (
              <p className="text-base font-semibold tabular-nums" style={{ color: "var(--chart-1)" }}>
                {formatMoney(totalInvoiced)}
              </p>
            ) : (
              <Skeleton className="mt-1 h-5 w-24" />
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Collected</p>
            {stats ? (
              <p className="text-base font-semibold tabular-nums" style={{ color: "var(--chart-2)" }}>
                {formatMoney(totalCollected)}
              </p>
            ) : (
              <Skeleton className="mt-1 h-5 w-24" />
            )}
          </div>
        </div>
      </div>

      {stats ? (
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
      ) : (
        <Skeleton className="mt-4 h-56 w-full" />
      )}
    </div>
  )
}
