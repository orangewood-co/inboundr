import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BoxIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit3Icon,
  IndianRupeeIcon,
  PackagePlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  TagIcon,
  TableIcon,
  UploadIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { CopyableText } from "@/components/copy-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
import { API_ORIGIN } from "@/lib/env"
import { formatNumber } from "@/lib/format"
import { ProductSettingsSheet } from "@/components/product-settings-sheet"
import {
  formatCatalogMoney,
  legacyCalibrationAdjustment,
  type CatalogAdjustment,
  type CatalogAttributeValue,
  type ProductSettings,
} from "@/lib/catalog"
const API_BASE = `${API_ORIGIN}/api/v1/products`
const PAGE_LIMIT = 20

function getInitialListSearch(): string {
  return new URLSearchParams(window.location.search).get("search") ?? ""
}

interface Product {
  id: string
  brand: string | null
  maxdiscount: number | string | null
  productdescription: string | null
  productcode: string | null
  unitprice: number | string | null
  hsncode: string | null
  gstrate: number | string | null
  productlink: string | null
  maxupsell: number | string | null
  calibrationcharges: number | string | null
  unit: string | null
  is_top_seller: boolean | null
  addedtime: string | null
  addeduser: string | null
  category?: string | null
  tags?: string[]
  attributes?: Record<string, CatalogAttributeValue>
  defaultAdjustments?: CatalogAdjustment[]
}

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ProductStats {
  totalProducts: number
  uniqueBrands: number
  avgUnitPrice: number
  recentlyAdded: number
}

type ProductFormState = {
  brand: string
  maxdiscount: string
  productdescription: string
  productcode: string
  unitprice: string
  hsncode: string
  gstrate: string
  productlink: string
  maxupsell: string
  calibrationcharges: string
  unit: string
  is_top_seller: boolean
  addedtime: string
  addeduser: string
  category: string
  tags: string
  attributes: Record<string, string | boolean>
  adjustmentValues: Record<string, string>
}

const emptyForm: ProductFormState = {
  brand: "",
  maxdiscount: "",
  productdescription: "",
  productcode: "",
  unitprice: "",
  hsncode: "",
  gstrate: "",
  productlink: "",
  maxupsell: "",
  calibrationcharges: "",
  unit: "",
  is_top_seller: false,
  addedtime: "",
  addeduser: "",
  category: "",
  tags: "",
  attributes: {},
  adjustmentValues: {},
}

const numericFields: Array<keyof ProductFormState> = [
  "maxdiscount",
  "unitprice",
  "gstrate",
  "maxupsell",
  "calibrationcharges",
]

function toPercent(value: Product["gstrate"]) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "-"
  return `${number}%`
}

function toDateInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function productToForm(product: Product): ProductFormState {
  return {
    brand: product.brand ?? "",
    maxdiscount: product.maxdiscount?.toString() ?? "",
    productdescription: product.productdescription ?? "",
    productcode: product.productcode ?? "",
    unitprice: product.unitprice?.toString() ?? "",
    hsncode: product.hsncode ?? "",
    gstrate: product.gstrate?.toString() ?? "",
    productlink: product.productlink ?? "",
    maxupsell: product.maxupsell?.toString() ?? "",
    calibrationcharges: product.calibrationcharges?.toString() ?? "",
    unit: product.unit ?? "",
    is_top_seller: Boolean(product.is_top_seller),
    addedtime: toDateInput(product.addedtime),
    addeduser: product.addeduser ?? "",
    category: product.category ?? "",
    tags: (product.tags ?? []).join(", "),
    attributes: Object.fromEntries(
      Object.entries(product.attributes ?? {}).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value ?? "")])
    ),
    adjustmentValues: Object.fromEntries(
      (product.defaultAdjustments ?? legacyCalibrationAdjustment(product.calibrationcharges)).map((item) => [item.code, String(item.value)])
    ),
  }
}

function formToPayload(form: ProductFormState, settings: ProductSettings | null) {
  const legacyPayload = Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (key === "attributes" || key === "adjustmentValues" || key === "tags" || key === "category") {
        return [key, undefined]
      }
      if (key === "is_top_seller") {
        return [key, Boolean(value)]
      }
      if (numericFields.includes(key as keyof ProductFormState)) {
        const stringValue = String(value)
        return [key, stringValue.trim() === "" ? null : Number(stringValue)]
      }
      if (key === "addedtime") {
        const dateValue = form.addedtime
        return [key, dateValue ? new Date(dateValue).toISOString() : new Date().toISOString()]
      }
      const stringValue = String(value)
      return [key, stringValue.trim() === "" ? null : stringValue.trim()]
    })
  )
  const definitions = settings?.fieldDefinitions.filter((field) => field.isActive) ?? []
  const attributes = Object.fromEntries(definitions.map((field) => {
    const value = form.attributes[field.key]
    if (field.type === "number") return [field.key, value === "" ? null : Number(value)]
    return [field.key, value]
  }))
  const defaultAdjustments = (settings?.adjustmentDefinitions ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      id: item.id,
      code: item.code,
      label: item.label,
      type: item.type,
      value: Number(form.adjustmentValues[item.code] || 0),
      taxable: item.taxable,
    }))
    .filter((item) => item.value > 0)
  return {
    ...legacyPayload,
    category: form.category.trim() || null,
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    attributes,
    defaultAdjustments,
  }
}

function ProductForm({
  form,
  onChange,
  settings,
}: {
  form: ProductFormState
  onChange: (field: keyof ProductFormState, value: string | boolean) => void
  settings: ProductSettings | null
}) {
  return (
    <div className="grid gap-5 px-5 pb-5">
      <div className="grid gap-2">
        <Label htmlFor="productdescription">{settings?.terminology.singular ?? "Product"} description</Label>
        <textarea
          id="productdescription"
          rows={4}
          value={form.productdescription}
          onChange={(event) => onChange("productdescription", event.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          placeholder="High accuracy digital caliper, 0-150 mm..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="productcode">{settings?.terminology.skuLabel ?? "SKU"}</Label>
          <Input id="productcode" value={form.productcode} onChange={(event) => onChange("productcode", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="brand">{settings?.terminology.manufacturerLabel ?? "Manufacturer"}</Label>
          <Input id="brand" value={form.brand} onChange={(event) => onChange("brand", event.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="is_top_seller">Top seller</Label>
          <p className="text-xs text-muted-foreground">
            Prioritize this product when RFQ matches are otherwise close.
          </p>
        </div>
        <Switch
          id="is_top_seller"
          checked={form.is_top_seller}
          onCheckedChange={(checked) => onChange("is_top_seller", checked)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="unitprice">Unit price</Label>
          <Input id="unitprice" type="number" value={form.unitprice} onChange={(event) => onChange("unitprice", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gstrate">{settings?.terminology.taxRateLabel ?? "Tax rate"}</Label>
          <Input id="gstrate" type="number" value={form.gstrate} onChange={(event) => onChange("gstrate", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" value={form.unit} onChange={(event) => onChange("unit", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="maxdiscount">Max discount</Label>
          <Input id="maxdiscount" type="number" value={form.maxdiscount} onChange={(event) => onChange("maxdiscount", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxupsell">Max upsell</Label>
          <Input id="maxupsell" type="number" value={form.maxupsell} onChange={(event) => onChange("maxupsell", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" value={form.category} onChange={(event) => onChange("category", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" value={form.tags} onChange={(event) => onChange("tags", event.target.value)} placeholder="retail, seasonal" />
        </div>
      </div>

      {(settings?.fieldDefinitions ?? []).filter((field) => field.isActive).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {settings!.fieldDefinitions.filter((field) => field.isActive).map((field) => (
            <div className="grid gap-2" key={field.id}>
              <Label htmlFor={`attribute-${field.key}`}>{field.label}{field.required ? " *" : ""}</Label>
              {field.type === "boolean" ? (
                <Switch
                  id={`attribute-${field.key}`}
                  checked={form.attributes[field.key] === true}
                  onCheckedChange={(checked) => onChange("attributes", {
                    ...form.attributes,
                    [field.key]: checked,
                  } as never)}
                />
              ) : field.type === "select" ? (
                <select
                  id={`attribute-${field.key}`}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={String(form.attributes[field.key] ?? "")}
                  onChange={(event) => onChange("attributes", {
                    ...form.attributes,
                    [field.key]: event.target.value,
                  } as never)}
                >
                  <option value="">Select an option</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <Input
                  id={`attribute-${field.key}`}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={String(form.attributes[field.key] ?? "")}
                  onChange={(event) => onChange("attributes", {
                    ...form.attributes,
                    [field.key]: event.target.value,
                  } as never)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {(settings?.adjustmentDefinitions ?? []).filter((item) => item.isActive).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {settings!.adjustmentDefinitions.filter((item) => item.isActive).map((item) => (
            <div className="grid gap-2" key={item.id}>
              <Label htmlFor={`adjustment-${item.code}`}>
                {item.label} ({item.type === "percentage" ? "%" : settings?.currency})
              </Label>
              <Input
                id={`adjustment-${item.code}`}
                type="number"
                min="0"
                value={form.adjustmentValues[item.code] ?? ""}
                onChange={(event) => onChange("adjustmentValues", {
                  ...form.adjustmentValues,
                  [item.code]: event.target.value,
                } as never)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
        <Label htmlFor="hsncode">{settings?.terminology.taxCodeLabel ?? "Tax code"}</Label>
          <Input id="hsncode" value={form.hsncode} onChange={(event) => onChange("hsncode", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="addedtime">Added date</Label>
          <Input id="addedtime" type="date" value={form.addedtime} onChange={(event) => onChange("addedtime", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="productlink">Product link</Label>
        <Input id="productlink" value={form.productlink} onChange={(event) => onChange("productlink", event.target.value)} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="addeduser">Added user</Label>
        <Input id="addeduser" value={form.addeduser} onChange={(event) => onChange("addeduser", event.target.value)} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: string
  icon: typeof BoxIcon
  loading: boolean
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      )}
    </div>
  )
}

function DashboardView({
  stats,
  statsLoading,
  recentProducts,
  recentLoading,
  onViewCatalog,
  onAddProduct,
  onBulkImport,
  currency,
  onOpenSettings,
  terminology,
}: {
  stats: ProductStats | null
  statsLoading: boolean
  recentProducts: Product[]
  recentLoading: boolean
  onViewCatalog: () => void
  onAddProduct: () => void
  onBulkImport: () => void
  currency: string
  onOpenSettings: () => void
  terminology: ProductSettings["terminology"] | undefined
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">{terminology?.plural ?? "Products"}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your {terminology?.singular.toLowerCase() ?? "product"} catalog, add new items, and track catalog stats.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenSettings}>
          <Settings2Icon className="size-4" />
          Catalog settings
        </Button>
      </div>

      <div className="space-y-6 p-6 animate-in fade-in-0 duration-300">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Products"
            value={formatNumber(stats?.totalProducts ?? 0)}
            icon={BoxIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Unique Brands"
            value={formatNumber(stats?.uniqueBrands ?? 0)}
            icon={TagIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Avg. Unit Price"
            value={stats?.avgUnitPrice ? formatCatalogMoney(stats.avgUnitPrice, currency) : "—"}
            icon={IndianRupeeIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Added This Month"
            value={formatNumber(stats?.recentlyAdded ?? 0)}
            icon={CalendarPlusIcon}
            loading={statsLoading}
          />
        </div>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={onViewCatalog}
            className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <TableIcon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">View Catalog</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse, search, and edit all products in the catalog table.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onAddProduct}
            className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <PackagePlusIcon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">New Product</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a new catalog entry for future quotes and matching.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onBulkImport}
            className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <UploadIcon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Bulk Upload</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Import catalog rows from CSV or Excel with column matching.
              </p>
            </div>
          </button>
        </div>

        {/* Recent products */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <BoxIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recently Added</h2>
          </div>
          <div className="overflow-hidden rounded-lg border">
            {recentLoading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : recentProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <BoxIcon className="size-5 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No products yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Code
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Brand
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                          {product.productcode || `#${product.id}`}
                        </span>
                        {product.is_top_seller && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            Top seller
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 font-medium">
                        {product.productdescription || "Untitled product"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {product.brand || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatCatalogMoney(product.unitprice, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const initialSearch = getInitialListSearch()
  const [view, setView] = useState<"dashboard" | "table">(initialSearch ? "table" : "dashboard")
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch.trim())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [settings, setSettings] = useState<ProductSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [stats, setStats] = useState<ProductStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [recentProducts, setRecentProducts] = useState<Product[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/stats`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch stats")
      const data: ProductStats = await res.json()
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchRecentProducts = useCallback(async () => {
    setRecentLoading(true)
    try {
      const res = await fetch(`${API_BASE}?page=1&limit=5`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch recent products")
      const data: ProductsResponse = await res.json()
      setRecentProducts(data.products)
    } catch {
      setRecentProducts([])
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
    void fetchRecentProducts()
    void fetch(`${API_BASE}/settings`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setSettings(value as ProductSettings | null))
  }, [fetchStats, fetchRecentProducts])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`${API_BASE}?${params}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Unable to fetch products")

      const data = (await response.json()) as ProductsResponse
      setProducts(data.products)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch products")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (view === "table") {
      void fetchProducts()
    }
  }, [fetchProducts, view])

  const visibleRange = useMemo(() => {
    if (total === 0) return "0"
    const start = (page - 1) * PAGE_LIMIT + 1
    const end = Math.min(page * PAGE_LIMIT, total)
    return `${start}-${end}`
  }, [page, total])

  function openCreateSheet() {
    setEditingProduct(null)
    setForm({
      ...emptyForm,
      addedtime: new Date().toISOString().slice(0, 10),
      attributes: Object.fromEntries(
        (settings?.fieldDefinitions ?? []).filter((field) => field.isActive).map((field) => [field.key, ""])
      ),
      adjustmentValues: Object.fromEntries(
        (settings?.adjustmentDefinitions ?? []).filter((item) => item.isActive).map((item) => [item.code, String(item.defaultValue || "")])
      ),
    })
    setSaveError(null)
    setSheetOpen(true)
  }

  function openImportPage() {
    void navigate({ to: "/products/import" })
  }

  function openEditSheet(product: Product) {
    setEditingProduct(product)
    setForm(productToForm(product))
    setSaveError(null)
    setSheetOpen(true)
  }

  async function saveProduct() {
    setSaving(true)
    setSaveError(null)

    try {
      let response = await fetch(editingProduct ? `${API_BASE}/${editingProduct.id}` : API_BASE, {
        method: editingProduct ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form, settings)),
      })

      let payload = await response.json().catch(() => null)
      if (!response.ok && response.status === 404 && editingProduct?.productcode) {
        const lookup = await fetch(`${API_BASE}?page=1&limit=10&search=${encodeURIComponent(editingProduct.productcode)}`, {
          credentials: "include",
        })
        if (lookup.ok) {
          const lookupData = (await lookup.json()) as ProductsResponse
          const refreshed = lookupData.products.find(
            (product) => product.productcode === editingProduct.productcode
          )
          if (refreshed?.id && refreshed.id !== editingProduct.id) {
            response = await fetch(`${API_BASE}/${refreshed.id}`, {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formToPayload(form, settings)),
            })
            payload = await response.json().catch(() => null)
          }
        }
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save product")
      }

      setSheetOpen(false)
      toast.success(editingProduct ? "Product updated" : "Product created")
      if (view === "table") {
        await fetchProducts()
      }
      void fetchStats()
      void fetchRecentProducts()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <AppLayout>
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-hidden">
          {view === "dashboard" ? (
            <DashboardView
              stats={stats}
              statsLoading={statsLoading}
              recentProducts={recentProducts}
              recentLoading={recentLoading}
              onViewCatalog={() => setView("table")}
              onAddProduct={openCreateSheet}
              onBulkImport={openImportPage}
              currency={settings?.currency ?? "INR"}
              onOpenSettings={() => setSettingsOpen(true)}
              terminology={settings?.terminology}
            />
          ) : (
            <>
              <PageToolbar
                icon={BoxIcon}
                title={settings?.terminology.plural ?? "Products"}
                count={loading ? null : total}
                leading={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setView("dashboard")}
                      >
                        <ArrowLeftIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Back to dashboard</TooltipContent>
                  </Tooltip>
                }
                actions={
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                          <Settings2Icon className="size-4" />
                          Settings
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Configure catalog fields and matching</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => void fetchProducts()}
                          disabled={loading}
                        >
                          <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Refresh</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={openImportPage}>
                          <UploadIcon className="size-4" />
                          Import
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Import products from CSV or Excel</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={openCreateSheet}>
                          <PackagePlusIcon className="size-4" />
                          New Product
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add a new catalog product</TooltipContent>
                    </Tooltip>
                  </>
                }
              />

              <div className="flex items-center gap-4 border-b px-4 py-3">
                <div className="relative max-w-xl flex-1">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${settings?.terminology.manufacturerLabel ?? "manufacturer"}, ${settings?.terminology.skuLabel ?? "SKU"}, ${settings?.terminology.taxCodeLabel ?? "tax code"}, description...`}
                    className="pl-10"
                  />
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{visibleRange}</span> of{" "}
                  <span className="font-semibold text-foreground">{formatNumber(total)}</span>
                </span>
              </div>

              {error ? (
                <ErrorState message={error} onRetry={() => void fetchProducts()} />
              ) : loading ? (
                <ListSkeleton rows={8} columns={6} />
              ) : products.length === 0 ? (
                <EmptyState
                  icon={BoxIcon}
                  title={debouncedSearch ? "No Products Match That Search" : "No Products in the Catalog Yet"}
                  description={
                    debouncedSearch
                      ? "Try a product code, brand, HSN code, or a shorter description fragment."
                      : "Add the first catalog item and it will appear in this table immediately."
                  }
                  action={
                    debouncedSearch ? undefined : (
                      <Button size="sm" onClick={openCreateSheet}>
                        <PackagePlusIcon className="size-4" />
                        New Product
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="flex-1 overflow-auto animate-in fade-in-0 duration-300">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-2.5">{settings?.terminology.skuLabel ?? "SKU"}</th>
                        <th className="px-5 py-2.5">{settings?.terminology.singular ?? "Product"}</th>
                        <th className="px-5 py-2.5">{settings?.terminology.manufacturerLabel ?? "Manufacturer"}</th>
                        <th className="px-5 py-2.5">Price</th>
                        <th className="px-5 py-2.5">{settings?.terminology.taxRateLabel ?? "Tax"}</th>
                        <th className="px-5 py-2.5">Margin</th>
                        <th className="w-10 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="group border-b last:border-0 transition-colors hover:bg-muted/30">
                          <td className="px-5 py-3.5 align-top">
                            <CopyableText value={product.productcode || ''} label="Product code copied">
                              <span className="inline-flex rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs font-bold">
                                {product.productcode || `#${product.id}`}
                              </span>
                            </CopyableText>
                            {product.is_top_seller && (
                              <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                Top seller
                              </span>
                            )}
                          </td>
                          <td className="max-w-xl px-5 py-3.5 align-top">
                            <p className="line-clamp-2 font-medium leading-5">{product.productdescription || "Untitled product"}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <CopyableText value={product.hsncode || ''} label="HSN code copied"><span>{product.hsncode || "No HSN"}</span></CopyableText>
                              <span className="text-border">/</span>
                              <span>{product.unit || "Unit not set"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 align-top font-medium">{product.brand || "-"}</td>
                          <td className="px-5 py-3.5 align-top font-semibold">{formatCatalogMoney(product.unitprice, settings?.currency ?? "INR")}</td>
                          <td className="px-5 py-3.5 align-top">{toPercent(product.gstrate)}</td>
                          <td className="px-5 py-3.5 align-top">
                            <div className="space-y-0.5 text-xs">
                              <p>
                                Discount <span className="font-semibold text-foreground">{toPercent(product.maxdiscount)}</span>
                              </p>
                              <p>
                                Upsell <span className="font-semibold text-foreground">{toPercent(product.maxupsell)}</span>
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" onClick={() => openEditSheet(product)}>
                                  <Edit3Icon className="size-4" />
                                  <span className="sr-only">Edit product</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit product</TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
                        <ChevronLeftIcon className="size-4" />
                        Previous
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous page</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                        Next
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next page</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </>
          )}
        </div>
    </AppLayout>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl">
              {editingProduct ? "Edit Product" : "New Product"}
            </SheetTitle>
            <SheetDescription>
              {editingProduct
                ? "Update catalog data and save it directly to the backend."
                : "Create a new catalog row for future quotes and matching."}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ProductForm
            form={form}
            settings={settings}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }) as ProductFormState)}
          />
          {saveError && (
            <div className="mx-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </div>
          )}
          <SheetFooter className="flex-row justify-end border-t bg-muted/30">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveProduct} disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              {editingProduct ? "Save Changes" : "Create Product"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {settingsOpen && (
        <ProductSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          endpoint={`${API_BASE}/settings`}
          onSaved={setSettings}
        />
      )}

    </>
  )
}
