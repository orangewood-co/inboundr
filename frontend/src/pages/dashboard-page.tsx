import { type CSSProperties, useCallback, useEffect, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileTextIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderIcon,
  UserIcon,
  PackageIcon,
  SearchIcon,
  TagIcon,
  RotateCcwIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CircleCheckIcon,
  CircleIcon,
  SparklesIcon,
  SendIcon,
} from "lucide-react"

const API_BASE = "http://localhost:3000/api/v1/rfq"

interface RFQEmail {
  _id: string
  subject: string
  from: string
  date: string
  snippet: string | null
  status: string
}

interface RFQCustomer {
  name: string
  company: string
  email: string
  contactNumber: string | null
  address: string | null
}

interface RFQProduct {
  name: string
  quantity: number
}

interface RFQSearchMatch {
  id: number
  brand: string | null
  description: string | null
  code: string | null
  price: number | null
  hsnCode: string | null
  gstRate: number | null
  score: number
  matchReasons: string[]
}

interface RFQSearchResult {
  query: { name: string; quantity: number }
  normalizedQuery: string
  status: "matched" | "ambiguous" | "no_match"
  matches: RFQSearchMatch[]
}

interface RFQSummary {
  _id: string
  emailId: RFQEmail
  isRFQ: boolean
  reason: string
  isProcessed: boolean
  customer: RFQCustomer | null
  queryProducts: RFQProduct[]
  searchResults: RFQSearchResult[]
  errorMessage: string | null
  createdAt: string
}

interface ListResponse {
  rfqs: RFQSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface RFQReply {
  _id: string
  rfqId: string
  selectedProducts: {
    queryName: string
    quantity: number
    productId: number
    brand: string | null
    description: string | null
    code: string | null
    price: number | null
    hsnCode: string | null
    gstRate: number | null
  }[]
  subject: string
  body: string
  to: string
  generatedAt: string
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+)>$/)
  if (match) return { name: match[1].trim(), email: match[2] }
  return { name: from, email: from }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type ProcessingStatus = "processing" | "processed" | "failed"

const statusConfig: Record<
  ProcessingStatus,
  { icon: typeof LoaderIcon; label: string; className: string }
> = {
  processing: {
    icon: LoaderIcon,
    label: "Processing",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  processed: {
    icon: CheckCircle2Icon,
    label: "Processed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    icon: AlertCircleIcon,
    label: "Failed",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
}

function StatusBadge({ isProcessed, errorMessage }: { isProcessed: boolean; errorMessage: string | null }) {
  const status: ProcessingStatus = errorMessage ? "failed" : isProcessed ? "processed" : "processing"
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}
    >
      <Icon className={`size-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  )
}

const matchStatusConfig = {
  matched: { label: "Matched", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  ambiguous: { label: "Ambiguous", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  no_match: { label: "No Match", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
}

function MatchStatusBadge({ status }: { status: "matched" | "ambiguous" | "no_match" }) {
  const config = matchStatusConfig[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}>
      {config.label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-6">
        <FileTextIcon className="size-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No RFQs yet</p>
        <p className="text-xs text-muted-foreground/60">
          Incoming RFQ emails will be processed and displayed here.
        </p>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-0.5 p-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

function DetailPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="rounded-xl bg-muted/40 p-4">
        <FileTextIcon className="size-8 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">Select an RFQ to view details</p>
    </div>
  )
}

export function DashboardPage() {
  const [rfqs, setRfqs] = useState<RFQSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RFQSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Product selection: searchResultIndex -> matchIndex
  const [selectedProducts, setSelectedProducts] = useState<Record<number, number>>({})
  const [generating, setGenerating] = useState(false)
  const [reply, setReply] = useState<RFQReply | null>(null)

  const fetchList = useCallback(async (p: number) => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch(`${API_BASE}?page=${p}&limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ListResponse = await res.json()
      setRfqs(data.rfqs)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (err: any) {
      setListError(err.message || "Failed to load RFQs")
    } finally {
      setListLoading(false)
    }
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`${API_BASE}/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: RFQSummary = await res.json()
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(1)
  }, [fetchList])

  const fetchReply = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/reply`)
      if (res.ok) {
        const data: RFQReply = await res.json()
        setReply(data)
      } else {
        setReply(null)
      }
    } catch {
      setReply(null)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
      fetchReply(selectedId)
      setSelectedProducts({})
    }
  }, [selectedId, fetchDetail, fetchReply])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchList(page)
    setRefreshing(false)
  }

  const handleRetry = async (id: string) => {
    setRetrying(true)
    try {
      const res = await fetch(`${API_BASE}/${id}/retry`, { method: "POST" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTimeout(async () => {
        await fetchList(page)
        if (selectedId === id) {
          await fetchDetail(id)
        }
        setRetrying(false)
      }, 2000)
    } catch {
      setRetrying(false)
    }
  }

  const handleSelectProduct = (searchResultIndex: number, matchIndex: number) => {
    setSelectedProducts((prev) => {
      const next = { ...prev }
      if (next[searchResultIndex] === matchIndex) {
        delete next[searchResultIndex]
      } else {
        next[searchResultIndex] = matchIndex
      }
      return next
    })
  }

  const handleGenerateQuote = async () => {
    if (!detail) return
    setGenerating(true)
    try {
      const selections = Object.entries(selectedProducts).map(([sri, mi]) => ({
        searchResultIndex: Number(sri),
        matchIndex: mi,
      }))
      const res = await fetch(`${API_BASE}/${detail._id}/generate-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedProducts: selections }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: RFQReply = await res.json()
      setReply(data)
    } catch (err: any) {
      console.error("Failed to generate quote:", err)
    } finally {
      setGenerating(false)
    }
  }

  const hasSelections = Object.keys(selectedProducts).length > 0

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
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex flex-1 overflow-hidden">
          {/* ── RFQ List Panel ── */}
          <div className="flex w-full flex-col border-r md:w-[380px] md:min-w-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">RFQ Requests</h2>
                {!listLoading && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                    {total}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <ListSkeleton />
              ) : listError ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <AlertCircleIcon className="size-5 text-destructive" />
                  <p className="text-sm text-destructive">{listError}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchList(page)}>
                    Retry
                  </Button>
                </div>
              ) : rfqs.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-0.5 p-1">
                  {rfqs.map((rfq) => {
                    const email = rfq.emailId
                    const senderName = rfq.customer?.company || parseSender(email.from).name
                    const initial = senderName.charAt(0).toUpperCase()
                    const isSelected = selectedId === rfq._id
                    return (
                      <button
                        key={rfq._id}
                        onClick={() => setSelectedId(rfq._id)}
                        className={`group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/8 ring-1 ring-primary/20"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {initial}
                            </div>
                            <span className="truncate text-sm font-semibold">{senderName}</span>
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatDate(rfq.createdAt)}
                          </span>
                        </div>
                        <div className="pl-[42px]">
                          <p className="truncate text-sm font-medium leading-snug">
                            {email.subject || "(no subject)"}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <StatusBadge isProcessed={rfq.isProcessed} errorMessage={rfq.errorMessage} />
                            {rfq.queryProducts.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <PackageIcon className="size-3" />
                                {rfq.queryProducts.length} product{rfq.queryProducts.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => fetchList(page - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page >= totalPages}
                    onClick={() => fetchList(page + 1)}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── RFQ Detail Panel ── */}
          <div className="hidden flex-1 flex-col overflow-hidden md:flex">
            {detailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <DetailPlaceholder />
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto">
                {/* Detail header */}
                <div className="space-y-3 border-b px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg font-semibold leading-snug">
                        {detail.emailId.subject || "(no subject)"}
                      </h1>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatFullDate(detail.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge isProcessed={detail.isProcessed} errorMessage={detail.errorMessage} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => {
                          setSelectedId(null)
                          setDetail(null)
                        }}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                {detail.customer && (
                  <div className="border-b px-6 py-5">
                    <div className="mb-3 flex items-center gap-2">
                      <UserIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Customer Information</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          <UserIcon className="size-3" />
                          Name
                        </div>
                        <p className="mt-1 text-sm font-medium">{detail.customer.name}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          <BuildingIcon className="size-3" />
                          Company
                        </div>
                        <p className="mt-1 text-sm font-medium">{detail.customer.company}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          <MailIcon className="size-3" />
                          Email
                        </div>
                        <p className="mt-1 text-sm font-medium">{detail.customer.email}</p>
                      </div>
                      {detail.customer.contactNumber && (
                        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <PhoneIcon className="size-3" />
                            Phone
                          </div>
                          <p className="mt-1 text-sm font-medium">{detail.customer.contactNumber}</p>
                        </div>
                      )}
                      {detail.customer.address && (
                        <div className="col-span-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <MapPinIcon className="size-3" />
                            Address
                          </div>
                          <p className="mt-1 text-sm font-medium">{detail.customer.address}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Requested Products */}
                {detail.queryProducts.length > 0 && (
                  <div className="border-b px-6 py-5">
                    <div className="mb-3 flex items-center gap-2">
                      <PackageIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Requested Products</h2>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Product
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Qty
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.queryProducts.map((p, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{p.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{p.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Search Results — Selectable */}
                {detail.searchResults.length > 0 && (
                  <div className="border-b px-6 py-5">
                    <div className="mb-1 flex items-center gap-2">
                      <SearchIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Product Matches</h2>
                    </div>
                    <p className="mb-4 text-[11px] text-muted-foreground">
                      Select a product for each query to include in the quotation.
                    </p>
                    <div className="space-y-5">
                      {detail.searchResults.map((sr, i) => (
                        <div key={i}>
                          {/* Query header */}
                          <div className="mb-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PackageIcon className="size-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">
                                {sr.query.name}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                                Qty: {sr.query.quantity}
                              </span>
                            </div>
                            <MatchStatusBadge status={sr.status} />
                          </div>

                          {/* Product cards */}
                          {sr.matches.length > 0 ? (
                            <div className="grid gap-2.5">
                              {sr.matches.map((m, j) => {
                                const isSelected = selectedProducts[i] === j
                                return (
                                  <button
                                    key={j}
                                    type="button"
                                    onClick={() => handleSelectProduct(i, j)}
                                    className={`w-full cursor-pointer rounded-lg border p-3.5 text-left transition-all ${
                                      isSelected
                                        ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                                        : j === 0
                                          ? "border-primary/20 bg-primary/5 hover:border-primary/40"
                                          : "bg-muted/20 hover:border-muted-foreground/30"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Selection indicator */}
                                      <div className="shrink-0 pt-0.5">
                                        {isSelected ? (
                                          <CircleCheckIcon className="size-5 text-primary" />
                                        ) : (
                                          <CircleIcon className="size-5 text-muted-foreground/30" />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold leading-snug">
                                            {m.description || "—"}
                                          </p>
                                          {j === 0 && sr.status === "matched" && (
                                            <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                              Best Match
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                          {m.brand && (
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                              <TagIcon className="size-3" />
                                              {m.brand}
                                            </span>
                                          )}
                                          {m.code && (
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                                              {m.code}
                                            </span>
                                          )}
                                          {m.hsnCode && (
                                            <span className="text-[11px] text-muted-foreground">
                                              HSN: {m.hsnCode}
                                            </span>
                                          )}
                                          {m.gstRate != null && (
                                            <span className="text-[11px] text-muted-foreground">
                                              GST: {m.gstRate}%
                                            </span>
                                          )}
                                        </div>

                                        {m.matchReasons.length > 0 && (
                                          <div className="mt-1.5 flex flex-wrap gap-1">
                                            {m.matchReasons.map((r, k) => (
                                              <span
                                                key={k}
                                                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                              >
                                                {r}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <div className="shrink-0 text-right">
                                        {m.price != null ? (
                                          <p className="text-base font-bold tabular-nums">
                                            ₹{m.price.toLocaleString("en-IN")}
                                          </p>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">No price</p>
                                        )}
                                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                          Score: {m.score}
                                        </p>
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                              No matching products found in the catalog
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Generate Quote Button */}
                    <div className="mt-5 flex items-center gap-3">
                      <Button
                        onClick={handleGenerateQuote}
                        disabled={!hasSelections || generating}
                        className="gap-2"
                      >
                        {generating ? (
                          <LoaderIcon className="size-4 animate-spin" />
                        ) : (
                          <SparklesIcon className="size-4" />
                        )}
                        {generating ? "Generating Quote..." : "Generate Quote"}
                      </Button>
                      {!hasSelections && (
                        <p className="text-xs text-muted-foreground">
                          Select at least one product to generate a quote
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Generated Quote Reply */}
                {reply && (
                  <div className="border-b px-6 py-5">
                    <div className="mb-3 flex items-center gap-2">
                      <SendIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Generated Quote</h2>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Draft
                      </span>
                    </div>
                    <div className="rounded-lg border bg-muted/10">
                      {/* Email header */}
                      <div className="space-y-2 border-b px-4 py-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-muted-foreground">To:</span>
                          <span>{reply.to}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-muted-foreground">Subject:</span>
                          <span className="font-medium">{reply.subject}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Generated {formatFullDate(reply.generatedAt)}
                        </div>
                      </div>
                      {/* Email body */}
                      <div className="px-4 py-4">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                          {reply.body}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classification Reason */}
                <div className="border-b px-6 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Classification</h2>
                  </div>
                  <p className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
                    {detail.reason}
                  </p>
                </div>

                {/* Error message if any */}
                {detail.errorMessage && (
                  <div className="px-6 pb-5">
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
                      <div className="mb-1 flex items-center gap-1.5">
                        <AlertCircleIcon className="size-3.5 text-red-600 dark:text-red-400" />
                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                          Processing Error
                        </span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-400">{detail.errorMessage}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                        disabled={retrying}
                        onClick={() => handleRetry(detail._id)}
                      >
                        <RotateCcwIcon className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
                        {retrying ? "Retrying..." : "Retry Processing"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardPage
