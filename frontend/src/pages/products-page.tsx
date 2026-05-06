import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit3Icon,
  LoaderIcon,
  PackagePlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const API_BASE = "http://localhost:3000/api/v1/products"
const PAGE_LIMIT = 20

interface Product {
  id: number
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
  addedtime: string | null
  addeduser: string | null
}

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
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
  addedtime: string
  addeduser: string
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
  addedtime: "",
  addeduser: "",
}

const numericFields: Array<keyof ProductFormState> = [
  "maxdiscount",
  "unitprice",
  "gstrate",
  "maxupsell",
  "calibrationcharges",
]

function toCurrency(value: Product["unitprice"]) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "Price pending"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number)
}

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
    addedtime: toDateInput(product.addedtime),
    addeduser: product.addeduser ?? "",
  }
}

function formToPayload(form: ProductFormState) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (numericFields.includes(key as keyof ProductFormState)) {
        return [key, value.trim() === "" ? null : Number(value)]
      }
      if (key === "addedtime") {
        return [key, value ? new Date(value).toISOString() : new Date().toISOString()]
      }
      return [key, value.trim() === "" ? null : value.trim()]
    })
  )
}

function ProductTableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[1.1fr_2fr_1fr_0.8fr_0.8fr_0.7fr_3rem] gap-4 px-5 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
        <div className="relative rounded-3xl border bg-background/80 p-6 shadow-sm">
          <BoxIcon className="size-10 text-muted-foreground" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">
          {search ? "No products match that search" : "No products in the catalog yet"}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {search
            ? "Try a product code, brand, HSN code, or a shorter description fragment."
            : "Add the first catalog item and it will appear in this table immediately."}
        </p>
      </div>
    </div>
  )
}

function ProductForm({
  form,
  onChange,
}: {
  form: ProductFormState
  onChange: (field: keyof ProductFormState, value: string) => void
}) {
  return (
    <div className="grid gap-5 px-5 pb-5">
      <div className="grid gap-2">
        <Label htmlFor="productdescription">Product description</Label>
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
          <Label htmlFor="productcode">Product code</Label>
          <Input id="productcode" value={form.productcode} onChange={(event) => onChange("productcode", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={form.brand} onChange={(event) => onChange("brand", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="unitprice">Unit price</Label>
          <Input id="unitprice" type="number" value={form.unitprice} onChange={(event) => onChange("unitprice", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gstrate">GST rate</Label>
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
        <div className="grid gap-2">
          <Label htmlFor="calibrationcharges">Calibration charges</Label>
          <Input id="calibrationcharges" type="number" value={form.calibrationcharges} onChange={(event) => onChange("calibrationcharges", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="hsncode">HSN code</Label>
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`${API_BASE}?${params}`)
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
    void fetchProducts()
  }, [fetchProducts])

  const visibleRange = useMemo(() => {
    if (total === 0) return "0"
    const start = (page - 1) * PAGE_LIMIT + 1
    const end = Math.min(page * PAGE_LIMIT, total)
    return `${start}-${end}`
  }, [page, total])

  function openCreateSheet() {
    setEditingProduct(null)
    setForm({ ...emptyForm, addedtime: new Date().toISOString().slice(0, 10) })
    setSaveError(null)
    setSheetOpen(true)
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
      const response = await fetch(editingProduct ? `${API_BASE}/${editingProduct.id}` : API_BASE, {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save product")
      }

      setSheetOpen(false)
      await fetchProducts()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="relative flex flex-1 flex-col overflow-hidden bg-muted/30">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
            <section className="overflow-hidden rounded-[2rem] border bg-background shadow-sm">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <SparklesIcon className="size-3.5 text-primary" />
                      Live catalog controls
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                        Products command center
                      </h1>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                        Search, tune, and extend the BTSA catalog without leaving the workflow.
                        Every edit writes back to the products database.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:flex">
                    <div className="rounded-2xl border bg-muted/35 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Rows</p>
                      <p className="mt-1 text-2xl font-black">{total.toLocaleString("en-IN")}</p>
                    </div>
                    <Button className="h-auto rounded-2xl px-5 py-3 font-semibold shadow-sm" onClick={openCreateSheet}>
                      <PackagePlusIcon className="size-4" />
                      Add Product
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border bg-background shadow-sm">
              <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-xl flex-1">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search brand, product code, HSN, description..."
                    className="h-11 rounded-2xl bg-muted/35 pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing <span className="font-semibold text-foreground">{visibleRange}</span> of{" "}
                    <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span>
                  </span>
                  <Button variant="outline" size="icon-sm" onClick={() => void fetchProducts()} disabled={loading}>
                    <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {error ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-10 text-center">
                  <div className="rounded-2xl bg-destructive/10 p-4 text-destructive">
                    <AlertCircleIcon className="size-8" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Products could not load</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  </div>
                  <Button variant="outline" onClick={() => void fetchProducts()}>
                    Try again
                  </Button>
                </div>
              ) : loading ? (
                <ProductTableSkeleton />
              ) : products.length === 0 ? (
                <EmptyState search={debouncedSearch} />
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/45 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-5 py-3">Code</th>
                        <th className="px-5 py-3">Product</th>
                        <th className="px-5 py-3">Brand</th>
                        <th className="px-5 py-3">Price</th>
                        <th className="px-5 py-3">GST</th>
                        <th className="px-5 py-3">Margin</th>
                        <th className="w-14 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="group border-b last:border-0 transition-colors hover:bg-primary/[0.035]">
                          <td className="px-5 py-4 align-top">
                            <div className="inline-flex rounded-lg border bg-muted/40 px-2.5 py-1 font-mono text-xs font-bold text-foreground">
                              {product.productcode || `#${product.id}`}
                            </div>
                          </td>
                          <td className="max-w-xl px-5 py-4 align-top">
                            <p className="line-clamp-2 font-semibold leading-5">{product.productdescription || "Untitled product"}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{product.hsncode || "No HSN"}</span>
                              <span className="text-border">/</span>
                              <span>{product.unit || "Unit not set"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top font-medium">{product.brand || "-"}</td>
                          <td className="px-5 py-4 align-top font-bold">{toCurrency(product.unitprice)}</td>
                          <td className="px-5 py-4 align-top">{toPercent(product.gstrate)}</td>
                          <td className="px-5 py-4 align-top">
                            <div className="space-y-1 text-xs">
                              <p>
                                Discount <span className="font-semibold text-foreground">{toPercent(product.maxdiscount)}</span>
                              </p>
                              <p>
                                Upsell <span className="font-semibold text-foreground">{toPercent(product.maxupsell)}</span>
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <Button variant="ghost" size="icon-sm" className="opacity-70 group-hover:opacity-100" onClick={() => openEditSheet(product)}>
                              <Edit3Icon className="size-4" />
                              <span className="sr-only">Edit product</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
                    <ChevronLeftIcon className="size-4" />
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                    Next
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </SidebarInset>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl">
              {editingProduct ? "Edit product" : "Add product"}
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
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          />
          {saveError && (
            <div className="mx-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {saveError}
            </div>
          )}
          <SheetFooter className="border-t bg-muted/30">
            <Button onClick={saveProduct} disabled={saving}>
              {saving && <LoaderIcon className="size-4 animate-spin" />}
              {editingProduct ? "Save changes" : "Create product"}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}
