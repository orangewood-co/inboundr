import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  DownloadIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

interface InvoiceStats {
  totalInvoiced: number
  outstanding: number
  overdue: number
  paidThisMonth: number
  countByStatus: Record<string, number>
}

const statusOptions = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "written_off"]

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
    toast.success(`Sent ${successCount} of ${drafts.length} invoices`)
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
    toast.success(`Cancelled ${successCount} of ${cancellable.length} invoices`)
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
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ReceiptTextIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Invoices</h2>
              {!loading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                  {total.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={invoices.length === 0}>
                <DownloadIcon className="size-4" />
                Export CSV
              </Button>
              <Button size="sm" asChild>
                <Link to="/invoices/new" search={{ edit: undefined }}>
                  <PlusIcon className="size-4" />
                  New invoice
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-3 border-b p-4 md:grid-cols-4">
            <StatCard label="Total invoiced" value={formatMoney(stats?.totalInvoiced ?? 0)} />
            <StatCard label="Outstanding" value={formatMoney(stats?.outstanding ?? 0)} />
            <StatCard label="Overdue" value={formatMoney(stats?.overdue ?? 0)} tone="danger" />
            <StatCard label="Paid this month" value={formatMoney(stats?.paidThisMonth ?? 0)} />
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
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All invoices" : labelStatus(option)}
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
                  Send drafts
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
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <AlertCircleIcon className="size-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchInvoices()}>Try again</Button>
            </div>
          ) : loading ? (
            <div className="divide-y">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 px-5 py-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <ReceiptTextIcon className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">No invoices yet</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Create your first invoice to start tracking payments and revenue.
              </p>
              <Button size="sm" asChild>
                <Link to="/invoices/new" search={{ edit: undefined }}>
                  <PlusIcon className="size-4" />
                  Create invoice
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
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
          <div className="mt-auto flex items-center justify-between border-t px-4 py-3">
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

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", tone === "danger" && "text-destructive")}>{value}</p>
    </div>
  )
}
