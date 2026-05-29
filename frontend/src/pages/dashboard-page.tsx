import { useCallback, useEffect, useState } from "react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDefaultLayout } from "react-resizable-panels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  RotateCcwIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CircleCheckIcon,
  CircleIcon,
  SparklesIcon,
  SendIcon,
  PlusIcon,
  Trash2Icon,
  DownloadIcon,
  ArchiveIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ContactHoverCard, SenderHoverCard } from "@/components/contact-hover-card"
import { CopyableText } from "@/components/copy-button"
import { openDownload } from "@/lib/downloads"
import { getAvatarColor } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/rfq`
const PRODUCTS_API_BASE = `${API_ORIGIN}/api/v1/products`

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
  isTopSeller?: boolean
  score: number
  matchReasons: string[]
}

interface RFQSearchResult {
  query: { name: string; quantity: number }
  normalizedQuery: string
  status: "matched" | "ambiguous" | "no_match"
  matches: RFQSearchMatch[]
}

interface RFQSavedQuoteProduct {
  searchResultIndex: number | null
  queryName: string
  quantity: number
  productId: number
  brand: string | null
  description: string | null
  code: string | null
  price: number | null
  hsnCode: string | null
  gstRate: number | null
  discountPercent?: number
  calibrationCharges?: number | null
  deliveryTimeline?: string | null
  lineStatus?: "quoted" | "regretted"
  regretReason?: string | null
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
  workflowStatus?: "new" | "draft" | "processed"
  savedQuoteProducts?: RFQSavedQuoteProduct[]
  quoteNumber?: string | null
  draftSavedAt?: string | null
  processedAt?: string | null
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
  sendStatus: "draft" | "sending" | "sent" | "failed"
  sentAt: string | null
  gmailMessageId: string | null
  sendErrorMessage: string | null
}

interface CatalogProduct {
  id: number
  brand: string | null
  productdescription: string | null
  productcode: string | null
  unitprice: number | string | null
  hsncode: string | null
  gstrate: number | string | null
  is_top_seller?: boolean | null
}

interface ProductsResponse {
  products: CatalogProduct[]
}

interface ManualProduct {
  id: string
  searchResultIndex: number | null
  queryName: string
  quantity: string
  productId: number
  brand: string
  description: string
  code: string
  price: string
  hsnCode: string
  gstRate: string
  calibrationCharges: string
  deliveryTimeline: string
  source: "catalog" | "custom"
}

interface ProductOverride {
  description?: string
  brand?: string
  code?: string
  hsnCode?: string
  gstRate?: string
  price?: string
  quantity?: string
  discountPercent?: string
  calibrationCharges?: string
  deliveryTimeline?: string
}

interface RegrettedLine {
  searchResultIndex: number
  queryName: string
  quantity: number
  regretReason: string
}

type ManualProductField = keyof Pick<
  ManualProduct,
  "queryName" | "quantity" | "brand" | "description" | "code" | "price" | "hsnCode" | "gstRate" | "calibrationCharges" | "deliveryTimeline"
>

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

function numberInputValue(value: number | string | null | undefined): string {
  if (value == null) return ""
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : ""
}

function catalogProductToManual(product: CatalogProduct, query?: RFQSearchResult["query"]): ManualProduct {
  return {
    id: `${product.id}-${Date.now()}`,
    searchResultIndex: null,
    queryName: query?.name || product.productdescription || product.productcode || "Catalog product",
    quantity: query ? String(query.quantity) : "1",
    productId: product.id,
    brand: product.brand ?? "",
    description: product.productdescription ?? "",
    code: product.productcode ?? "",
    price: numberInputValue(product.unitprice),
    hsnCode: product.hsncode ?? "",
    gstRate: numberInputValue(product.gstrate),
    calibrationCharges: "",
    deliveryTimeline: "",
    source: "catalog",
  }
}

type ProcessingStatus = "analyzing" | "ready" | "draft" | "processed" | "failed"
type RFQStatusFilter = "all" | ProcessingStatus
type RFQSortOption = "created_desc" | "created_asc" | "updated_desc" | "updated_asc"

const statusConfig: Record<
  ProcessingStatus,
  { icon: typeof LoaderIcon; label: string; className: string }
> = {
  analyzing: {
    icon: LoaderIcon,
    label: "Analyzing",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  ready: {
    icon: CheckCircle2Icon,
    label: "Ready",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  draft: {
    icon: FileTextIcon,
    label: "Draft",
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
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

function getWorkflowStatus(rfq: Pick<RFQSummary, "isProcessed" | "errorMessage" | "workflowStatus">): ProcessingStatus {
  if (rfq.errorMessage) return "failed"
  if (!rfq.isProcessed) return "analyzing"
  if (rfq.workflowStatus === "processed") return "processed"
  if (rfq.workflowStatus === "draft") return "draft"
  return "ready"
}

function getWorkflowStatusTooltip(rfq: Pick<RFQSummary, "isProcessed" | "errorMessage" | "workflowStatus" | "quoteNumber">): string {
  const status = getWorkflowStatus(rfq)
  if (status === "failed") return "Processing error occurred"
  if (status === "analyzing") return "AI is extracting this RFQ"
  if (status === "draft") return "Product selection saved as a draft"
  if (status === "processed") return rfq.quoteNumber ? `Quote ${rfq.quoteNumber} entered` : "Quote number entered"
  return "Ready for product selection"
}

function StatusBadge({ rfq }: { rfq: Pick<RFQSummary, "isProcessed" | "errorMessage" | "workflowStatus"> }) {
  const status = getWorkflowStatus(rfq)
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.className}`}
    >
      <Icon className={`size-3 ${status === "analyzing" ? "animate-spin" : ""}`} />
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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "btsa:layout:rfq",
    storage: localStorage,
  })

  const [rfqs, setRfqs] = useState<RFQSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RFQStatusFilter>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortOption, setSortOption] = useState<RFQSortOption>("created_desc")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RFQSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // Product selection: searchResultIndex -> matchIndexes
  const [selectedProducts, setSelectedProducts] = useState<Record<number, number[]>>({})
  const [productOverrides, setProductOverrides] = useState<Record<string, ProductOverride>>({})
  const [manualProducts, setManualProducts] = useState<ManualProduct[]>([])
  const [activeManualProductQueryIndex, setActiveManualProductQueryIndex] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState("")
  const [productResults, setProductResults] = useState<CatalogProduct[]>([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)
  const [customProduct, setCustomProduct] = useState<ManualProduct>({
    id: "custom-draft",
    searchResultIndex: null,
    queryName: "",
    quantity: "1",
    productId: 0,
    brand: "",
    description: "",
    code: "",
    price: "",
    hsnCode: "",
    gstRate: "",
    calibrationCharges: "",
    deliveryTimeline: "",
    source: "custom",
  })
  const [regrettedLines, setRegrettedLines] = useState<Record<number, RegrettedLine>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sendingQuote, setSendingQuote] = useState(false)
  const [reply, setReply] = useState<RFQReply | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archivingRfq, setArchivingRfq] = useState(false)

  const hasActiveFilters =
    statusFilter !== "all" ||
    dateFrom.trim() !== "" ||
    dateTo.trim() !== "" ||
    sortOption !== "created_desc"
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (dateFrom.trim() !== "" || dateTo.trim() !== "" ? 1 : 0) +
    (sortOption !== "created_desc" ? 1 : 0)

  const fetchList = useCallback(async (p: number) => {
    setListLoading(true)
    setListError(null)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: "20",
        status: statusFilter,
        sort: sortOption,
      })
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      const res = await fetch(`${API_BASE}?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ListResponse = await res.json()
      setRfqs(data.rfqs)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
      return data
    } catch (err: any) {
      setListError(err.message || "Failed to load RFQs")
      return null
    } finally {
      setListLoading(false)
    }
  }, [dateFrom, dateTo, sortOption, statusFilter])

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`${API_BASE}/${id}`, { credentials: "include" })
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

  const clearFilters = () => {
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setSortOption("created_desc")
  }

  const fetchReply = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/reply`, {
        credentials: "include",
      })
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
      setProductOverrides({})
      setManualProducts([])
      setRegrettedLines({})
      setActiveManualProductQueryIndex(null)
      setProductSearch("")
      setProductResults([])
      setProductSearchError(null)
    }
  }, [selectedId, fetchDetail, fetchReply])

  useEffect(() => {
    if (!detail?.savedQuoteProducts?.length) return

    const nextSelectedProducts: Record<number, number[]> = {}
    const nextOverrides: Record<string, ProductOverride> = {}
    const unmatchedProducts: ManualProduct[] = []
    const nextRegrettedLines: Record<number, RegrettedLine> = {}

    detail.savedQuoteProducts.forEach((product, productIndex) => {
      if (product.lineStatus === "regretted") {
        const searchResultIndex = product.searchResultIndex ?? productIndex
        nextRegrettedLines[searchResultIndex] = {
          searchResultIndex,
          queryName: product.queryName,
          quantity: product.quantity,
          regretReason: product.regretReason ?? "Not available in catalog",
        }
        return
      }

      let matched = false

      for (let searchResultIndex = 0; searchResultIndex < detail.searchResults.length; searchResultIndex += 1) {
        const searchResult = detail.searchResults[searchResultIndex]
        const matchIndex = searchResult.matches.findIndex((match) => match.id === product.productId)

        if (matchIndex >= 0 && product.productId !== 0) {
          const overrideKey = `${searchResultIndex}-${matchIndex}`
          nextSelectedProducts[searchResultIndex] = [
            ...(nextSelectedProducts[searchResultIndex] ?? []),
            matchIndex,
          ]
          nextOverrides[overrideKey] = {
            description: product.description ?? "",
            brand: product.brand ?? "",
            code: product.code ?? "",
            hsnCode: product.hsnCode ?? "",
            gstRate: product.gstRate != null ? String(product.gstRate) : "",
            price: product.price != null ? String(product.price) : "",
            quantity: String(product.quantity),
            discountPercent: product.discountPercent ? String(product.discountPercent) : "",
            calibrationCharges: product.calibrationCharges != null ? String(product.calibrationCharges) : "",
            deliveryTimeline: product.deliveryTimeline ?? "",
          }
          matched = true
          break
        }
      }

      if (!matched) {
        unmatchedProducts.push({
          id: `saved-${productIndex}-${product.productId}`,
          searchResultIndex: product.searchResultIndex ?? null,
          queryName: product.queryName,
          quantity: String(product.quantity),
          productId: product.productId,
          brand: product.brand ?? "",
          description: product.description ?? "",
          code: product.code ?? "",
          price: product.price != null ? String(product.price) : "",
          hsnCode: product.hsnCode ?? "",
          gstRate: product.gstRate != null ? String(product.gstRate) : "",
          calibrationCharges: product.calibrationCharges != null ? String(product.calibrationCharges) : "",
          deliveryTimeline: product.deliveryTimeline ?? "",
          source: product.productId ? "catalog" : "custom",
        })
      }
    })

    setSelectedProducts(nextSelectedProducts)
    setProductOverrides(nextOverrides)
    setManualProducts(unmatchedProducts)
    setRegrettedLines(nextRegrettedLines)
  }, [detail])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return

      switch (e.key) {
        case "j":
        case "J": {
          e.preventDefault()
          if (rfqs.length === 0) return
          const idx = rfqs.findIndex((r) => r._id === selectedId)
          setSelectedId(rfqs[idx < rfqs.length - 1 ? idx + 1 : 0]._id)
          break
        }
        case "k":
        case "K": {
          e.preventDefault()
          if (rfqs.length === 0) return
          const idx = rfqs.findIndex((r) => r._id === selectedId)
          setSelectedId(rfqs[idx > 0 ? idx - 1 : rfqs.length - 1]._id)
          break
        }
        case "Escape": {
          setSelectedId(null)
          setDetail(null)
          setReply(null)
          break
        }
        case "r":
        case "R": {
          if (!refreshing) {
            setRefreshing(true)
            fetchList(page).then(() => setRefreshing(false))
          }
          break
        }
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [rfqs, selectedId, refreshing, fetchList, page])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchList(page)
    setRefreshing(false)
  }

  const handleRetry = async (id: string) => {
    setRetrying(true)
    try {
      const res = await fetch(`${API_BASE}/${id}/retry`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTimeout(async () => {
        const list = await fetchList(page)
        if (selectedId === id) {
          const refreshed = list?.rfqs.find((rfq) => rfq.emailId._id === detail?.emailId._id)
          if (refreshed) {
            setSelectedId(refreshed._id)
            await fetchDetail(refreshed._id)
          } else {
            setSelectedId(null)
            setDetail(null)
            setReply(null)
          }
        }
        setRetrying(false)
      }, 2000)
    } catch {
      setRetrying(false)
    }
  }

  const handleSelectProduct = (searchResultIndex: number, matchIndex: number) => {
    if (regrettedLines[searchResultIndex]) return
    setSelectedProducts((prev) => {
      const next = { ...prev }
      const current = next[searchResultIndex] ?? []
      if (current.includes(matchIndex)) {
        const remaining = current.filter((index) => index !== matchIndex)
        if (remaining.length > 0) {
          next[searchResultIndex] = remaining
        } else {
          delete next[searchResultIndex]
        }
      } else {
        next[searchResultIndex] = [...current, matchIndex]
      }
      return next
    })
  }

  const handleToggleRegretLine = (searchResultIndex: number) => {
    const query = detail?.searchResults[searchResultIndex]?.query
    if (!query) return

    setRegrettedLines((prev) => {
      const next = { ...prev }
      if (next[searchResultIndex]) {
        delete next[searchResultIndex]
      } else {
        next[searchResultIndex] = {
          searchResultIndex,
          queryName: query.name,
          quantity: query.quantity,
          regretReason: "Not available in catalog",
        }
        setSelectedProducts((current) => {
          const updated = { ...current }
          delete updated[searchResultIndex]
          return updated
        })
        setManualProducts((current) => current.filter((product) => product.searchResultIndex !== searchResultIndex))
      }
      return next
    })
  }

  const handleRegretReasonChange = (searchResultIndex: number, regretReason: string) => {
    setRegrettedLines((prev) => ({
      ...prev,
      [searchResultIndex]: {
        ...(prev[searchResultIndex] ?? {
          searchResultIndex,
          queryName: detail?.searchResults[searchResultIndex]?.query.name ?? "",
          quantity: detail?.searchResults[searchResultIndex]?.query.quantity ?? 1,
        }),
        regretReason,
      },
    }))
  }

  const handleOverrideChange = (key: string, field: keyof ProductOverride, value: string) => {
    setProductOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSearchProducts = async () => {
    const search = productSearch.trim()
    if (!search) {
      setProductResults([])
      return
    }

    setProductSearchLoading(true)
    setProductSearchError(null)
    try {
      const res = await fetch(`${PRODUCTS_API_BASE}?page=1&limit=8&search=${encodeURIComponent(search)}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ProductsResponse = await res.json()
      setProductResults(data.products)
    } catch (err: any) {
      setProductSearchError(err.message || "Failed to search products")
      setProductResults([])
    } finally {
      setProductSearchLoading(false)
    }
  }

  const getManualProductQuery = (searchResultIndex: number | null) => {
    if (searchResultIndex == null) return undefined
    return detail?.searchResults[searchResultIndex]?.query
  }

  const handleToggleManualProductPanel = (searchResultIndex: number) => {
    setActiveManualProductQueryIndex((prev) => {
      if (prev === searchResultIndex) return null

      const query = detail?.searchResults[searchResultIndex]?.query
      if (query) {
        setCustomProduct((current) => ({
          ...current,
          searchResultIndex,
          queryName: query.name,
          quantity: String(query.quantity),
        }))
        setProductSearch(query.name)
        setProductResults([])
        setProductSearchError(null)
      }

      return searchResultIndex
    })
  }

  const handleAddCatalogProduct = (product: CatalogProduct) => {
    setManualProducts((prev) => [
      ...prev,
      {
        ...catalogProductToManual(product, getManualProductQuery(activeManualProductQueryIndex)),
        searchResultIndex: activeManualProductQueryIndex,
      },
    ])
  }

  const handleManualProductChange = (
    id: string,
    field: ManualProductField,
    value: string
  ) => {
    setManualProducts((prev) =>
      prev.map((product) => (product.id === id ? { ...product, [field]: value } : product))
    )
  }

  const handleRemoveManualProduct = (id: string) => {
    setManualProducts((prev) => prev.filter((product) => product.id !== id))
  }

  const handleCustomProductChange = (field: ManualProductField, value: string) => {
    setCustomProduct((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddCustomProduct = () => {
    if (!customProduct.queryName.trim() || !customProduct.quantity.trim()) return
    if (!customProduct.description.trim() && !customProduct.code.trim()) return

    setManualProducts((prev) => [
      ...prev,
      {
        ...customProduct,
        id: `custom-${Date.now()}`,
        searchResultIndex: activeManualProductQueryIndex,
        source: "custom",
        productId: 0,
      },
    ])
    setCustomProduct({
      id: "custom-draft",
      searchResultIndex: activeManualProductQueryIndex,
      queryName: "",
      quantity: "1",
      productId: 0,
      brand: "",
      description: "",
      code: "",
      price: "",
      hsnCode: "",
      gstRate: "",
      calibrationCharges: "",
      deliveryTimeline: "",
      source: "custom",
    })
  }

  const handleGenerateQuote = async () => {
    if (!detail) return
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/${detail._id}/generate-quote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload()),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: RFQReply = await res.json()
      setReply(data)
      toast.success("Quote generated successfully")
    } catch (err: any) {
      toast.error("Failed to generate quote")
      console.error("Failed to generate quote:", err)
    } finally {
      setGenerating(false)
    }
  }

  const buildDraftPayload = () => {
    const selections = Object.entries(selectedProducts).flatMap(([sri, matchIndexes]) =>
      matchIndexes.map((mi) => {
        const overrideKey = `${sri}-${mi}`
        const override = productOverrides[overrideKey]
        return {
          searchResultIndex: Number(sri),
          matchIndex: mi,
          ...(override ? { overrides: override } : {}),
        }
      })
    )
    const manualSelections = manualProducts.map((product) => ({
      searchResultIndex: product.searchResultIndex,
      queryName: product.queryName.trim(),
      quantity: Number(product.quantity),
      productId: product.productId,
      brand: product.brand.trim() || null,
      description: product.description.trim() || null,
      code: product.code.trim() || null,
      price: product.price.trim() === "" ? null : Number(product.price),
      hsnCode: product.hsnCode.trim() || null,
      gstRate: product.gstRate.trim() === "" ? null : Number(product.gstRate),
      calibrationCharges: product.calibrationCharges?.trim() ? Number(product.calibrationCharges) : null,
      deliveryTimeline: product.deliveryTimeline?.trim() || null,
    }))
    const regrettedSelections = Object.values(regrettedLines).map((line) => ({
      searchResultIndex: line.searchResultIndex,
      queryName: line.queryName,
      quantity: line.quantity,
      regretReason: line.regretReason.trim() || null,
    }))

    return { selectedProducts: selections, manualProducts: manualSelections, regrettedLines: regrettedSelections }
  }

  const handleSaveDraft = async () => {
    if (!detail) return
    setSavingDraft(true)
    try {
      const res = await fetch(`${API_BASE}/${detail._id}/save-draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload()),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: RFQSummary = await res.json()
      setDetail(data)
      setRfqs((current) => current.map((rfq) => (rfq._id === data._id ? data : rfq)))
      toast.success("RFQ draft saved")
    } catch (err) {
      toast.error("Failed to save RFQ draft")
      console.error("Failed to save RFQ draft:", err)
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSendQuote = async () => {
    if (!detail || !reply) return
    setSendingQuote(true)
    try {
      const res = await fetch(`${API_BASE}/${detail._id}/send-quote`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.reply) setReply(data.reply)
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setReply(data)
      toast.success("Quote sent successfully")
    } catch (err) {
      toast.error("Failed to send quote")
      console.error("Failed to send quote:", err)
    } finally {
      setSendingQuote(false)
    }
  }

  const handleArchiveRFQ = async () => {
    if (!detail) return

    setArchivingRfq(true)
    try {
      const res = await fetch(`${API_BASE}/${detail._id}/archive`, {
        method: "PATCH",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Failed to archive RFQ")
      }

      setArchiveConfirmOpen(false)
      setSelectedId(null)
      setDetail(null)
      setReply(null)
      toast.success("RFQ archived")
      await fetchList(page)
    } catch (err: any) {
      toast.error(err.message || "Failed to archive RFQ")
    } finally {
      setArchivingRfq(false)
    }
  }

  const hasSelections =
    Object.values(selectedProducts).some((matches) => matches.length > 0) ||
    manualProducts.length > 0 ||
    Object.keys(regrettedLines).length > 0

  const renderManualProductPopover = (searchResultIndex: number, query: RFQSearchResult["query"]) => (
    <Popover
      open={activeManualProductQueryIndex === searchResultIndex}
      onOpenChange={(open) => {
        if (open) {
          handleToggleManualProductPanel(searchResultIndex)
        } else {
          setActiveManualProductQueryIndex(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Add product
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] space-y-3 p-3">
        <div>
          <p className="truncate text-sm font-semibold">{query.name}</p>
          <p className="text-[11px] text-muted-foreground">Qty: {query.quantity}</p>
        </div>

        <div className="rounded-lg border bg-muted/20 p-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Search catalog
          </p>
        <div className="flex gap-2">
          <Input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleSearchProducts()
              }
            }}
            placeholder="Search product code, brand, HSN..."
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSearchProducts}
            disabled={productSearchLoading}
          >
            {productSearchLoading && <Spinner data-icon="inline-start" />}
            Search
          </Button>
        </div>
        {productSearchError && (
          <p className="mt-2 text-xs text-destructive">{productSearchError}</p>
        )}
        {productResults.length > 0 && (
          <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {productResults.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {product.productdescription || product.productcode || "Catalog product"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {product.brand && <span>{product.brand}</span>}
                    {product.productcode && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                        {product.productcode}
                      </span>
                    )}
                    {product.unitprice != null && (
                      <span>₹{Number(product.unitprice).toLocaleString("en-IN")}</span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    handleAddCatalogProduct(product)
                    setActiveManualProductQueryIndex(null)
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/20 p-2.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Custom line
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            value={customProduct.queryName}
            onChange={(event) => handleCustomProductChange("queryName", event.target.value)}
            placeholder="Line name"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.quantity}
            onChange={(event) => handleCustomProductChange("quantity", event.target.value)}
            placeholder="Qty"
            type="number"
            min="1"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.description}
            onChange={(event) => handleCustomProductChange("description", event.target.value)}
            placeholder="Description"
            className="col-span-2 h-8 text-xs"
          />
          <Input
            value={customProduct.code}
            onChange={(event) => handleCustomProductChange("code", event.target.value)}
            placeholder="Code"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.brand}
            onChange={(event) => handleCustomProductChange("brand", event.target.value)}
            placeholder="Brand"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.price}
            onChange={(event) => handleCustomProductChange("price", event.target.value)}
            placeholder="Price"
            type="number"
            min="0"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.hsnCode}
            onChange={(event) => handleCustomProductChange("hsnCode", event.target.value)}
            placeholder="HSN"
            className="h-8 text-xs"
          />
          <Input
            value={customProduct.gstRate}
            onChange={(event) => handleCustomProductChange("gstRate", event.target.value)}
            placeholder="GST %"
            type="number"
            min="0"
            className="h-8 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2 w-full gap-1.5 text-xs"
          onClick={() => {
            handleAddCustomProduct()
            setActiveManualProductQueryIndex(null)
          }}
        >
          <PlusIcon className="size-3.5" />
          Add custom line
        </Button>
      </div>
      </PopoverContent>
    </Popover>
  )

  return (
    <AppLayout>
        <SiteHeader />
        <ResizablePanelGroup orientation="horizontal" className="flex-1" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          {/* ── RFQ List Panel ── */}
          <ResizablePanel id="list" defaultSize="28%" minSize="18%" maxSize="45%" className="flex flex-col overflow-hidden">
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
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={hasActiveFilters ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs"
                    >
                      <SlidersHorizontalIcon className="size-4" />
                      Filter
                      {activeFilterCount > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-3 p-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Filters
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Refine RFQs by workflow status, date, and sort order.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RFQStatusFilter)}>
                        <SelectTrigger size="sm" className="w-full text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="analyzing">Analyzing</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="processed">Processed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortOption} onValueChange={(value) => setSortOption(value as RFQSortOption)}>
                        <SelectTrigger size="sm" className="w-full text-xs">
                          <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created_desc">Newest created</SelectItem>
                          <SelectItem value="created_asc">Oldest created</SelectItem>
                          <SelectItem value="updated_desc">Recently updated</SelectItem>
                          <SelectItem value="updated_asc">Oldest updated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          From
                        </label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="h-8 text-xs"
                          aria-label="RFQ date from"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          To
                        </label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
                          className="h-8 text-xs"
                          aria-label="RFQ date to"
                        />
                      </div>
                    </div>
                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-muted-foreground"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
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
                  <TooltipContent>Refresh (R)</TooltipContent>
                </Tooltip>
              </div>
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
                <div className="animate-in fade-in-0 duration-300 space-y-0.5 p-1">
                  {rfqs.map((rfq) => {
                    const email = rfq.emailId
                    const sender = parseSender(email.from)
                    const senderName = rfq.customer?.company || sender.name
                    const avatarColors = getAvatarColor(senderName)
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
                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${avatarColors.bg} ${avatarColors.text} text-xs font-bold`}>
                              {initial}
                            </div>
                            {rfq.customer ? (
                              <ContactHoverCard contact={{ name: rfq.customer.name, email: rfq.customer.email, company: rfq.customer.company, phone: rfq.customer.contactNumber ?? undefined, address: rfq.customer.address ?? undefined }}>
                                <span className="truncate text-sm font-semibold cursor-default">{senderName}</span>
                              </ContactHoverCard>
                            ) : (
                              <SenderHoverCard name={sender.name} email={sender.email}>
                                <span className="truncate text-sm font-semibold cursor-default">{senderName}</span>
                              </SenderHoverCard>
                            )}
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <StatusBadge rfq={rfq} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getWorkflowStatusTooltip(rfq)}
                              </TooltipContent>
                            </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={page <= 1}
                        onClick={() => fetchList(page - 1)}
                      >
                        <ChevronLeftIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous page</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={page >= totalPages}
                        onClick={() => fetchList(page + 1)}
                      >
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next page</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle />

          {/* ── RFQ Detail Panel ── */}
          <ResizablePanel id="detail" defaultSize="72%" minSize="40%" className="hidden flex-col overflow-hidden md:flex">
            {detailLoading ? (
              <DetailSkeleton />
            ) : !detail ? (
              <DetailPlaceholder />
            ) : (
              <div className="animate-in fade-in-0 duration-300 flex flex-1 flex-col overflow-y-auto">
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <StatusBadge rfq={detail} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {getWorkflowStatusTooltip(detail)}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => openDownload(`${API_BASE}/${detail._id}/pdf`)}
                          >
                            <DownloadIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download PDF</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-destructive hover:bg-destructive/10"
                            onClick={() => setArchiveConfirmOpen(true)}
                          >
                            <ArchiveIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive RFQ</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>Close (Esc)</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {detail.workflowStatus === "draft" && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
                      Draft saved
                      {detail.draftSavedAt ? ` ${formatFullDate(detail.draftSavedAt)}` : ""}
                      {detail.savedQuoteProducts?.length
                        ? ` with ${detail.savedQuoteProducts.length} product${detail.savedQuoteProducts.length === 1 ? "" : "s"}`
                        : ""}
                      .
                    </div>
                  )}
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
                        <CopyableText value={detail.customer.email} label="Email copied">
                          <p className="mt-1 text-sm font-medium">{detail.customer.email}</p>
                        </CopyableText>
                      </div>
                      {detail.customer.contactNumber && (
                        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <PhoneIcon className="size-3" />
                            Phone
                          </div>
                          <CopyableText value={detail.customer.contactNumber!} label="Phone copied">
                            <p className="mt-1 text-sm font-medium">{detail.customer.contactNumber}</p>
                          </CopyableText>
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
                      Select one or more products per query, or regret an item when it cannot be quoted.
                    </p>
                    <div className="space-y-5">
                      {detail.searchResults.map((sr, i) => {
                        const regrettedLine = regrettedLines[i]
                        return (
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
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant={regrettedLine ? "destructive" : "ghost"}
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleToggleRegretLine(i)}
                              >
                                {regrettedLine ? "Remove regret" : "Regret item"}
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <MatchStatusBadge status={sr.status} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {sr.status === "matched" ? "Product found in catalog" : sr.status === "ambiguous" ? "Multiple possible matches" : "No catalog match found"}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {regrettedLine && (
                            <div className="mb-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                              <p className="text-sm font-medium text-destructive">This requested item is regretted</p>
                              <Input
                                value={regrettedLine.regretReason}
                                onChange={(event) => handleRegretReasonChange(i, event.target.value)}
                                placeholder="Reason"
                                className="mt-2 h-8 text-xs"
                              />
                            </div>
                          )}

                          {/* Product cards */}
                          {!regrettedLine && sr.matches.length > 0 ? (
                            <div className="grid gap-2">
                              {sr.matches.map((m, j) => {
                                const isSelected = selectedProducts[i]?.includes(j) ?? false
                                const overrideKey = `${i}-${j}`
                                const override = productOverrides[overrideKey]
                                const effectivePrice = override?.price != null && override.price !== "" ? Number(override.price) : m.price
                                const discountPct = override?.discountPercent != null && override.discountPercent !== "" ? Number(override.discountPercent) : 0
                                const finalPrice = effectivePrice != null && Number.isFinite(effectivePrice) ? effectivePrice * (1 - discountPct / 100) : null
                                return (
                                  <div
                                    key={j}
                                    className={`rounded-lg border transition-all ${
                                      isSelected
                                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                        : j === 0
                                          ? "border-primary/20 bg-primary/5 hover:border-primary/40"
                                          : "bg-muted/20 hover:border-muted-foreground/30"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProduct(i, j)}
                                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left"
                                    >
                                      <div className="shrink-0">
                                        {isSelected ? (
                                          <CircleCheckIcon className="size-4.5 text-primary" />
                                        ) : (
                                          <CircleIcon className="size-4.5 text-muted-foreground/30" />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="truncate text-sm font-semibold leading-snug">
                                            {m.description || "—"}
                                          </p>
                                          {j === 0 && sr.status === "matched" && (
                                            <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                              Best
                                            </span>
                                          )}
                                          {m.isTopSeller && (
                                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                              Top seller
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                                          {m.brand && <span>{m.brand}</span>}
                                          {m.brand && m.code && <span>·</span>}
                                          {m.code && (
                                            <span className="font-mono">{m.code}</span>
                                          )}
                                          {(m.brand || m.code) && m.hsnCode && <span>·</span>}
                                          {m.hsnCode && <span>HSN: {m.hsnCode}</span>}
                                          {m.gstRate != null && <span>· GST: {m.gstRate}%</span>}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        {isSelected && discountPct > 0 && finalPrice != null ? (
                                          <>
                                            <p className="text-[11px] tabular-nums text-muted-foreground line-through">
                                              ₹{(effectivePrice ?? 0).toLocaleString("en-IN")}
                                            </p>
                                            <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                              ₹{finalPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                            </p>
                                          </>
                                        ) : m.price != null ? (
                                          <p className="text-sm font-bold tabular-nums">
                                            ₹{m.price.toLocaleString("en-IN")}
                                          </p>
                                        ) : (
                                          <p className="text-[11px] text-muted-foreground">No price</p>
                                        )}
                                      </div>
                                    </button>

                                    {isSelected && (
                                      <div className="border-t border-primary/15 px-3 pb-3 pt-2.5">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <label className="w-11 shrink-0 text-[10px] text-muted-foreground">Desc</label>
                                            <Input
                                              value={override?.description ?? m.description ?? ""}
                                              onChange={(e) => handleOverrideChange(overrideKey, "description", e.target.value)}
                                              className="h-7 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="w-11 shrink-0 text-[10px] text-muted-foreground">Brand</label>
                                            <Input
                                              value={override?.brand ?? m.brand ?? ""}
                                              onChange={(e) => handleOverrideChange(overrideKey, "brand", e.target.value)}
                                              className="h-7 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                            <label className="ml-1 w-9 shrink-0 text-[10px] text-muted-foreground">Code</label>
                                            <Input
                                              value={override?.code ?? m.code ?? ""}
                                              onChange={(e) => handleOverrideChange(overrideKey, "code", e.target.value)}
                                              className="h-7 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="w-11 shrink-0 text-[10px] text-muted-foreground">HSN</label>
                                            <Input
                                              value={override?.hsnCode ?? m.hsnCode ?? ""}
                                              onChange={(e) => handleOverrideChange(overrideKey, "hsnCode", e.target.value)}
                                              className="h-7 w-28 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                            <label className="ml-1 w-9 shrink-0 text-[10px] text-muted-foreground">GST%</label>
                                            <Input
                                              value={override?.gstRate ?? (m.gstRate != null ? String(m.gstRate) : "")}
                                              onChange={(e) => handleOverrideChange(overrideKey, "gstRate", e.target.value)}
                                              type="number"
                                              min="0"
                                              className="h-7 w-16 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                            <label className="ml-1 w-7 shrink-0 text-[10px] text-muted-foreground">Qty</label>
                                            <Input
                                              value={override?.quantity ?? String(sr.query.quantity)}
                                              onChange={(e) => handleOverrideChange(overrideKey, "quantity", e.target.value)}
                                              type="number"
                                              min="1"
                                              className="h-7 w-16 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2 pt-1">
                                            <label className="w-11 shrink-0 text-[10px] text-muted-foreground">Price</label>
                                            <div className="relative">
                                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                                              <Input
                                                value={override?.price ?? (m.price != null ? String(m.price) : "")}
                                                onChange={(e) => handleOverrideChange(overrideKey, "price", e.target.value)}
                                                type="number"
                                                min="0"
                                                className="h-7 w-28 border-muted-foreground/15 bg-transparent pl-5 text-xs"
                                              />
                                            </div>
                                            <label className="ml-1 w-9 shrink-0 text-[10px] text-muted-foreground">Disc.</label>
                                            <div className="relative">
                                              <Input
                                                value={override?.discountPercent ?? ""}
                                                onChange={(e) => handleOverrideChange(overrideKey, "discountPercent", e.target.value)}
                                                placeholder="0"
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="h-7 w-16 border-muted-foreground/15 bg-transparent pr-5 text-xs"
                                              />
                                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                                            </div>
                                            {finalPrice != null && discountPct > 0 && (
                                              <span className="ml-auto text-xs font-semibold tabular-nums text-emerald-500 dark:text-emerald-400">
                                                ₹{finalPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                                  ({discountPct}% off)
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 pt-1">
                                            <label className="w-11 shrink-0 text-[10px] text-muted-foreground">Calib.</label>
                                            <div className="relative">
                                              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                                              <Input
                                                value={override?.calibrationCharges ?? ""}
                                                onChange={(e) => handleOverrideChange(overrideKey, "calibrationCharges", e.target.value)}
                                                placeholder="0"
                                                type="number"
                                                min="0"
                                                className="h-7 w-28 border-muted-foreground/15 bg-transparent pl-5 text-xs"
                                              />
                                            </div>
                                            <label className="ml-1 w-14 shrink-0 text-[10px] text-muted-foreground">Delivery</label>
                                            <Input
                                              value={override?.deliveryTimeline ?? ""}
                                              onChange={(e) => handleOverrideChange(overrideKey, "deliveryTimeline", e.target.value)}
                                              placeholder="e.g. 2 weeks"
                                              className="h-7 border-muted-foreground/15 bg-transparent text-xs"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : !regrettedLine ? (
                            <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                              No matching products found in the catalog
                            </div>
                          ) : null}
                          {!regrettedLine && (
                            <div className="mt-2 flex items-center justify-end">
                              {renderManualProductPopover(i, sr.query)}
                            </div>
                          )}
                          {!regrettedLine && manualProducts.some((product) => product.searchResultIndex === i) && (
                            <div className="mt-3 space-y-2 rounded-xl border border-dashed bg-muted/10 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Added for this item
                              </p>
                              {manualProducts
                                .filter((product) => product.searchResultIndex === i)
                                .map((product) => (
                                  <div key={product.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                          {product.source === "catalog" ? "Catalog" : "Custom"}
                                        </span>
                                        <p className="truncate text-sm font-semibold">
                                          {product.description || product.queryName}
                                        </p>
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                        <span>Qty: {product.quantity}</span>
                                        {product.brand && <span>· {product.brand}</span>}
                                        {product.code && <span>· <span className="font-mono">{product.code}</span></span>}
                                        {product.price && <span>· ₹{Number(product.price).toLocaleString("en-IN")}</span>}
                                        {product.calibrationCharges && <span>· Calibration: ₹{Number(product.calibrationCharges).toLocaleString("en-IN")}</span>}
                                        {product.deliveryTimeline && <span>· Delivery: {product.deliveryTimeline}</span>}
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 text-muted-foreground"
                                      onClick={() => handleRemoveManualProduct(product.id)}
                                    >
                                      <Trash2Icon className="size-3.5" />
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        )
                      })}
                    </div>

                    {manualProducts.some((product) => product.searchResultIndex == null) && (
                    <div className="mt-5 rounded-xl border border-dashed p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Unassigned added products</p>
                          <p className="text-[11px] text-muted-foreground">
                            Legacy or unassigned quote lines not linked to a requested item.
                          </p>
                        </div>
                      </div>

                      {manualProducts.some((product) => product.searchResultIndex == null) && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Unassigned products
                          </p>
                          {manualProducts.filter((product) => product.searchResultIndex == null).map((product) => (
                            <div key={product.id} className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {product.source === "catalog" ? "Catalog" : "Custom"}
                                </span>
                                {product.searchResultIndex != null && (
                                  <span className="mr-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                                    For item {product.searchResultIndex + 1}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground"
                                  onClick={() => handleRemoveManualProduct(product.id)}
                                >
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <Input
                                  value={product.queryName}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "queryName", event.target.value)
                                  }
                                  placeholder="Line name"
                                />
                                <Input
                                  value={product.quantity}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "quantity", event.target.value)
                                  }
                                  placeholder="Quantity"
                                  type="number"
                                  min="1"
                                />
                                <Input
                                  value={product.description}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "description", event.target.value)
                                  }
                                  placeholder="Description"
                                />
                                <Input
                                  value={product.code}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "code", event.target.value)
                                  }
                                  placeholder="Code"
                                />
                                <Input
                                  value={product.brand}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "brand", event.target.value)
                                  }
                                  placeholder="Brand"
                                />
                                <Input
                                  value={product.price}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "price", event.target.value)
                                  }
                                  placeholder="Price"
                                  type="number"
                                  min="0"
                                />
                                <Input
                                  value={product.hsnCode}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "hsnCode", event.target.value)
                                  }
                                  placeholder="HSN"
                                />
                                <Input
                                  value={product.gstRate}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "gstRate", event.target.value)
                                  }
                                  placeholder="GST %"
                                  type="number"
                                  min="0"
                                />
                                <Input
                                  value={product.calibrationCharges ?? ""}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "calibrationCharges", event.target.value)
                                  }
                                  placeholder="Calibration charges"
                                  type="number"
                                  min="0"
                                />
                                <Input
                                  value={product.deliveryTimeline ?? ""}
                                  onChange={(event) =>
                                    handleManualProductChange(product.id, "deliveryTimeline", event.target.value)
                                  }
                                  placeholder="Delivery timeline"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Generate Quote Button */}
                    <div className="mt-5 flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={handleSaveDraft}
                        disabled={!hasSelections || savingDraft}
                        className="gap-2"
                      >
                        {savingDraft ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <FileTextIcon className="size-4" />
                        )}
                        Save Draft
                      </Button>
                      <Button
                        onClick={handleGenerateQuote}
                        disabled={!hasSelections || generating}
                        className="gap-2"
                      >
                        {generating ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SparklesIcon className="size-4" />
                        )}
                        Generate Quote
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        reply.sendStatus === "sent"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : reply.sendStatus === "failed"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {reply.sendStatus}
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
                          {reply.sentAt && ` · Sent ${formatFullDate(reply.sentAt)}`}
                        </div>
                      </div>
                      {/* Email body */}
                      <div className="px-4 py-4">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                          {reply.body}
                        </pre>
                      </div>
                    </div>
                    {reply.sendErrorMessage && (
                      <p className="mt-2 text-xs text-destructive">
                        {reply.sendErrorMessage}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <Button
                        onClick={handleSendQuote}
                        disabled={sendingQuote || reply.sendStatus === "sent"}
                        className="gap-2"
                      >
                        {sendingQuote || reply.sendStatus === "sending" ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SendIcon className="size-4" />
                        )}
                        {reply.sendStatus === "sent"
                          ? "Quote Sent"
                          : "Send Quote"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Sends from the connected Gmail account on the original thread.
                      </p>
                    </div>
                  </div>
                )}

                {/* Classification Reason */}
                <div className="border-b px-6 py-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">Classification</h2>
                    </div>
                    {detail.isProcessed && !detail.errorMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground opacity-35 hover:opacity-100"
                        disabled={retrying}
                        onClick={() => handleRetry(detail._id)}
                      >
                        {retrying ? (
                          <Spinner className="size-3" data-icon="inline-start" />
                        ) : (
                          <RotateCcwIcon className="size-3" />
                        )}
                        Rerun processing
                      </Button>
                    )}
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
                        {retrying ? (
                          <Spinner className="size-3.5" data-icon="inline-start" />
                        ) : (
                          <RotateCcwIcon className="size-3.5" />
                        )}
                        Retry Processing
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive RFQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this RFQ{detail?.customer?.company ? <> from <span className="font-medium text-foreground">{detail.customer.company}</span></> : ""}? It will no longer appear in your RFQ list or search results.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmOpen(false)} disabled={archivingRfq}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveRFQ} disabled={archivingRfq}>
              {archivingRfq && <Spinner data-icon="inline-start" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default DashboardPage
