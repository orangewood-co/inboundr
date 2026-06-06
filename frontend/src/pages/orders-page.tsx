import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FileTextIcon,
  MailIcon,
  PackageIcon,
  RefreshCwIcon,
  UserIcon,
} from "lucide-react"
import { useDefaultLayout } from "react-resizable-panels"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getAvatarColor } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/rfq`

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

interface RFQSavedQuoteProduct {
  searchResultIndex: number | null
  queryName: string
  quantity: number
  productId: number
  brand: string | null
  description: string | null
  code: string | null
  basePrice?: number | null
  price: number | null
  hsnCode: string | null
  gstRate: number | null
  discountPercent?: number | null
  calibrationCharges?: number | null
  deliveryTimeline?: string | null
  lineStatus?: "quoted" | "regretted"
  regretReason?: string | null
}

interface DraftRFQ {
  _id: string
  emailId: RFQEmail
  customer: RFQCustomer | null
  savedQuoteProducts: RFQSavedQuoteProduct[]
  paymentTermName?: string | null
  paymentTerms?: string | null
  quoteNotes?: string | null
  draftSavedAt: string | null
  createdAt: string
}

interface DraftsResponse {
  rfqs: DraftRFQ[]
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+)>$/)
  if (match) return { name: match[1].trim(), email: match[2] }
  return { name: from, email: from }
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
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

function formatPrice(value: number | null): string {
  if (value == null) return "No price"
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

function sortQuoteProductsByItem(products: RFQSavedQuoteProduct[]): RFQSavedQuoteProduct[] {
  return products
    .map((product, originalIndex) => ({ product, originalIndex }))
    .sort((a, b) => {
      const aIndex = a.product.searchResultIndex
      const bIndex = b.product.searchResultIndex

      if (aIndex == null && bIndex == null) return a.originalIndex - b.originalIndex
      if (aIndex == null) return 1
      if (bIndex == null) return -1

      return aIndex - bIndex || a.originalIndex - b.originalIndex
    })
    .map(({ product }) => product)
}

function normalizeDiscount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0
}

function resolveBasePrice(product: RFQSavedQuoteProduct): number | null {
  if (typeof product.basePrice === "number" && Number.isFinite(product.basePrice)) {
    return product.basePrice
  }

  const discount = normalizeDiscount(product.discountPercent)
  if (product.price == null || discount <= 0 || discount >= 100) return product.price

  return product.price / (1 - discount / 100)
}

function ProductPriceBreakdown({ product }: { product: RFQSavedQuoteProduct }) {
  const discount = normalizeDiscount(product.discountPercent)
  const hasDiscount = discount > 0 && product.price != null

  if (!hasDiscount) {
    return (
      <p className={`text-sm font-bold tabular-nums ${product.price == null ? "text-muted-foreground" : ""}`}>
        {formatPrice(product.price)}
      </p>
    )
  }

  return (
    <div className="space-y-0.5 text-xs tabular-nums">
      <p className="text-muted-foreground">
        <span className="mr-1">Price:</span>
        <span className="line-through">{formatPrice(resolveBasePrice(product))}</span>
      </p>
      <p className="text-muted-foreground">
        <span className="mr-1">Discount:</span>
        <span>{discount}%</span>
      </p>
      <p className="font-bold text-emerald-600 dark:text-emerald-400">
        <span className="mr-1 font-medium text-muted-foreground">Net:</span>
        {formatPrice(product.price)}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-6">
        <CheckCircle2Icon className="size-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No Draft RFQs</p>
        <p className="text-xs text-muted-foreground/60">
          Saved RFQ selections will appear here for quote number processing.
        </p>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-0.5 p-1">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg p-3">
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

function DetailPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="rounded-xl bg-muted/40 p-4">
        <ClipboardListIcon className="size-8 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">Select a draft RFQ to review products</p>
    </div>
  )
}

export function OrdersPage() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "btsa:layout:orders",
    storage: localStorage,
  })

  const [drafts, setDrafts] = useState<DraftRFQ[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quoteNumbers, setQuoteNumbers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft._id === selectedId) ?? null,
    [drafts, selectedId]
  )
  const orderedSelectedProducts = useMemo(
    () => sortQuoteProductsByItem(selectedDraft?.savedQuoteProducts ?? []),
    [selectedDraft]
  )

  const fetchDrafts = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/drafts`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DraftsResponse = await res.json()
      setDrafts(data.rfqs)
      setSelectedId((current) => {
        if (current && data.rfqs.some((draft) => draft._id === current)) return current
        return data.rfqs[0]?._id ?? null
      })
    } catch (err: any) {
      setError(err.message || "Failed to load draft RFQs")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDrafts()
  }

  const handleMarkProcessed = async (rfqId: string) => {
    const quoteNumber = quoteNumbers[rfqId]?.trim()
    if (!quoteNumber) {
      toast.error("Enter a quote number first")
      return
    }

    setProcessingId(rfqId)
    try {
      const res = await fetch(`${API_BASE}/${rfqId}/quote-number`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteNumber }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      setDrafts((current) => {
        const next = current.filter((draft) => draft._id !== rfqId)
        setSelectedId((selected) => {
          if (selected !== rfqId) return selected
          return next[0]?._id ?? null
        })
        return next
      })
      setQuoteNumbers((current) => {
        const next = { ...current }
        delete next[rfqId]
        return next
      })
      toast.success("RFQ marked processed")
    } catch (err) {
      toast.error("Failed to mark RFQ processed")
      console.error("Failed to mark RFQ processed:", err)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AppLayout>
      <SiteHeader />
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <ResizablePanel id="orders-list" defaultSize="30%" minSize="20%" maxSize="45%" className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardListIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Draft RFQs</h2>
              {!loading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                  {drafts.length}
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <ListSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <AlertCircleIcon className="size-5 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Retry
                </Button>
              </div>
            ) : drafts.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="animate-in fade-in-0 space-y-0.5 p-1 duration-300">
                {drafts.map((draft) => {
                  const sender = parseSender(draft.emailId.from)
                  const senderName = draft.customer?.company || draft.customer?.name || sender.name
                  const avatarColors = getAvatarColor(senderName)
                  const isSelected = selectedId === draft._id
                  const savedAt = draft.draftSavedAt || draft.createdAt

                  return (
                    <button
                      key={draft._id}
                      onClick={() => setSelectedId(draft._id)}
                      className={`group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-primary/8 ring-1 ring-primary/20" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${avatarColors.bg} ${avatarColors.text} text-xs font-bold`}>
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate text-sm font-semibold">{senderName}</span>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatDate(savedAt)}
                        </span>
                      </div>
                      <div className="pl-[42px]">
                        <p className="truncate text-sm font-medium leading-snug">
                          {draft.emailId.subject || "(no subject)"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <PackageIcon className="size-3" />
                            {draft.savedQuoteProducts.length} product{draft.savedQuoteProducts.length === 1 ? "" : "s"}
                          </span>
                          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                            Draft
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel id="orders-detail" defaultSize="70%" minSize="45%" className="hidden flex-col overflow-hidden md:flex">
          {!selectedDraft ? (
            <DetailPlaceholder />
          ) : (
            <div className="animate-in fade-in-0 flex flex-1 flex-col overflow-y-auto duration-300">
              <div className="space-y-4 border-b px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                        Draft
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Saved {formatFullDate(selectedDraft.draftSavedAt || selectedDraft.createdAt)}
                      </span>
                    </div>
                    <h1 className="text-lg font-semibold leading-snug">
                      {selectedDraft.emailId.subject || "(no subject)"}
                    </h1>
                    {selectedDraft.emailId.snippet && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {selectedDraft.emailId.snippet}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <UserIcon className="size-3" />
                      Customer
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {selectedDraft.customer?.company || selectedDraft.customer?.name || parseSender(selectedDraft.emailId.from).name}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <MailIcon className="size-3" />
                      Email
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {selectedDraft.customer?.email || parseSender(selectedDraft.emailId.from).email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b px-6 py-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Selected Products</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selectedDraft.savedQuoteProducts.length} product{selectedDraft.savedQuoteProducts.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {orderedSelectedProducts.map((product, index) => (
                    <div key={`${product.productId}-${index}`} className={`rounded-lg border bg-card p-3 ${product.lineStatus === "regretted" ? "border-destructive/25 bg-destructive/5" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{product.queryName}</p>
                            {product.searchResultIndex != null && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                                Item {product.searchResultIndex + 1}
                              </span>
                            )}
                            {product.lineStatus === "regretted" && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-destructive">
                                Regretted
                              </span>
                            )}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                              Qty: {product.quantity}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {product.lineStatus === "regretted"
                              ? product.regretReason || "Not available in catalog"
                              : product.description || "No description"}
                          </p>
                          {product.lineStatus !== "regretted" && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            {product.brand && <span>{product.brand}</span>}
                            {product.brand && product.code && <span>·</span>}
                            {product.code && <span className="font-mono">{product.code}</span>}
                            {(product.brand || product.code) && product.hsnCode && <span>·</span>}
                            {product.hsnCode && <span>HSN: {product.hsnCode}</span>}
                            {product.gstRate != null && <span>· GST: {product.gstRate}%</span>}
                            {product.calibrationCharges != null && <span>· Calibration: {formatPrice(product.calibrationCharges)}</span>}
                            {product.deliveryTimeline && <span>· Delivery: {product.deliveryTimeline}</span>}
                            </div>
                          )}
                        </div>
                        {product.lineStatus !== "regretted" && (
                          <div className="shrink-0 text-right">
                            <ProductPriceBreakdown product={product} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-b px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileTextIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Payment Terms</h2>
                  {selectedDraft.paymentTermName && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {selectedDraft.paymentTermName}
                    </span>
                  )}
                </div>
                {selectedDraft.paymentTerms?.trim() ? (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {selectedDraft.paymentTerms}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2.5">
                    <p className="text-sm text-muted-foreground">
                      No payment terms were saved with this draft.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-b px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardListIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Internal Quote Notes</h2>
                </div>
                {selectedDraft.quoteNotes?.trim() ? (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {selectedDraft.quoteNotes}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2.5">
                    <p className="text-sm text-muted-foreground">
                      No internal quote notes were saved with this draft.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-6 py-5">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold">Process RFQ</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter the quote number to mark this draft RFQ as Processed.
                    </p>
                  </div>
                  <div className="flex max-w-xl gap-2">
                    <Input
                      value={quoteNumbers[selectedDraft._id] ?? ""}
                      onChange={(event) =>
                        setQuoteNumbers((current) => ({
                          ...current,
                          [selectedDraft._id]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          handleMarkProcessed(selectedDraft._id)
                        }
                      }}
                      placeholder="Enter quote number"
                    />
                    <Button
                      className="shrink-0"
                      onClick={() => handleMarkProcessed(selectedDraft._id)}
                      disabled={processingId === selectedDraft._id}
                    >
                      {processingId === selectedDraft._id && <Spinner data-icon="inline-start" />}
                      Mark Processed
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </AppLayout>
  )
}

export default OrdersPage
