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

import { AppLayout } from "@/components/app-layout"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
import { invalidateInvoiceStats, invoiceStatsQueryOptions } from "@/lib/queries"
import { queryClient } from "@/lib/query-client"
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
  countByStatus: Record<string, number>
}

const statusOptions = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "written_off"]
const primaryStatusOptions = ["all", "draft", "sent", "overdue", "partially_paid", "paid"] as const

function labelStatus(status: string) {
  return status.replaceAll("_", " ")
}

function statusVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelled" || status === "written_off") return "destructive"
  if (status === "draft") return "outline"
  return "secondary"
}

function statusBadgeClass(status: InvoiceStatus) {
  if (status === "sent") return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
  if (status === "partially_paid") return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
  if (status === "overdue") return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
  if (status === "paid") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
  return ""
}

function formatDueDate(value: string | null) {
  if (!value) return "-"

  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) return "-"

  const today = new Date()
  const dueDay = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const daysUntilDue = Math.round((dueDay - currentDay) / 86_400_000)

  const relativeDate =
    daysUntilDue === 0
      ? "today"
      : daysUntilDue > 0
        ? `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`
        : `${Math.abs(daysUntilDue)} day${daysUntilDue === -1 ? "" : "s"} ago`

  return `${formatDate(dueDate)} · ${relativeDate}`
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
    try {
      // Shares its cache entry with the home overdue-invoices widget, so
      // refreshing here (e.g. after bulk send/cancel) updates both.
      await invalidateInvoiceStats()
      setStats((await queryClient.fetchQuery(invoiceStatsQueryOptions)) as InvoiceStats)
    } catch {
      // Stat cards keep their skeletons; the list is the primary content.
    }
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

          {/* Operational status views */}
          <div className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2">
            {primaryStatusOptions.map((option) => {
              const count =
                option === "all"
                  ? stats
                    ? Object.values(stats.countByStatus).reduce((sum, value) => sum + value, 0)
                    : total
                  : stats?.countByStatus[option] ?? 0

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setStatus(option)
                    setPage(1)
                    setSelected(new Set())
                  }}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium capitalize transition-colors",
                    status === option
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {option === "all" ? "All" : labelStatus(option)}
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      status === option ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filters + bulk actions */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <div className="relative min-w-72 flex-1">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice number, customer, PO..."
                className="pl-10"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
                setSelected(new Set())
              }}
            >
              <SelectTrigger className="w-40">
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
                  <tr className="sticky top-0 z-10 border-b bg-muted/95 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
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
                      <td className="px-5 py-3.5 align-top">{formatDueDate(invoice.dueDate)}</td>
                      <td className="px-5 py-3.5 align-top">
                        <Badge
                          variant={statusVariant(invoice.status)}
                          className={cn("capitalize", statusBadgeClass(invoice.status))}
                        >
                          {labelStatus(invoice.status)}
                        </Badge>
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
