import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CopyIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCatalogMoney, type ProductSettings } from "@/lib/catalog"
import { API_ORIGIN } from "@/lib/env"
import { cn } from "@/lib/utils"

const API_BASE = `${API_ORIGIN}/api/v1/products`
const PAGE_LIMIT = 25

type DuplicateMatchType = "sku" | "name"
type TypeFilter = "all" | DuplicateMatchType

interface DuplicateProduct {
  id: string
  brand: string | null
  productdescription: string | null
  productcode: string | null
  unitprice: number | string | null
  category?: string | null
  is_top_seller?: boolean | null
  name?: string | null
  sku?: string | null
  manufacturer?: string | null
  description?: string | null
}

interface DuplicateGroup {
  id: string
  type: DuplicateMatchType
  matchKey: string
  label: string
  secondaryLabel: string | null
  count: number
  products: DuplicateProduct[]
}

interface DuplicatesResponse {
  groups: DuplicateGroup[]
  summary: {
    skuGroupCount: number
    nameGroupCount: number
    totalGroups: number
    duplicateProductCount: number
  }
  page: number
  limit: number
  totalPages: number
}

function productLabel(product: DuplicateProduct) {
  return (
    product.productdescription ||
    product.description ||
    product.name ||
    product.productcode ||
    product.sku ||
    `Product ${product.id}`
  )
}

function productSku(product: DuplicateProduct) {
  return product.productcode || product.sku || "—"
}

function productBrand(product: DuplicateProduct) {
  return product.brand || product.manufacturer || "—"
}

export default function ProductsDuplicatesPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<ProductSettings | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DuplicatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DuplicateProduct | null>(null)
  const [deleting, setDeleting] = useState(false)

  const skuLabel = settings?.terminology.skuLabel ?? "SKU"
  const manufacturerLabel = settings?.terminology.manufacturerLabel ?? "Manufacturer"
  const plural = settings?.terminology.plural ?? "Products"

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, debouncedSearch])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/settings`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load catalog settings")
        return (await response.json()) as ProductSettings
      })
      .then((payload) => {
        if (!cancelled) setSettings(payload)
      })
      .catch(() => {
        // Terminology falls back to defaults when settings fail to load.
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function fetchDuplicates() {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
        type: typeFilter,
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`${API_BASE}/duplicates?${params}`, {
        credentials: "include",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to find duplicate products")
      }
      setData(payload as DuplicatesResponse)
    } catch (error) {
      setData(null)
      setLoadError(error instanceof Error ? error.message : "Unable to find duplicate products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDuplicates()
  }, [page, typeFilter, debouncedSearch])

  async function deleteProduct() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete product")
      }
      toast.success("Product deleted")
      setDeleteTarget(null)
      await fetchDuplicates()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete product")
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: "All Matches", count: data?.summary.totalGroups },
        { value: "sku" as const, label: `Same ${skuLabel}`, count: data?.summary.skuGroupCount },
        {
          value: "name" as const,
          label: "Same Name",
          count: data?.summary.nameGroupCount,
        },
      ] as const,
    [data?.summary, skuLabel]
  )

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: plural, href: "/products" },
          { label: "Find Duplicates" },
        ]}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 size-8"
                  onClick={() => void navigate({ to: "/products" })}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to products</TooltipContent>
            </Tooltip>
            <div>
              <h1 className="text-lg font-semibold">Find Duplicates</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Groups catalog rows that share a normalized {skuLabel.toLowerCase()}, or the same
                description and {manufacturerLabel.toLowerCase()}. Delete extras to clean up the
                catalog — merge is not available yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => void fetchDuplicates()}
                  disabled={loading}
                >
                  <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
          <div className="relative max-w-md flex-1 basis-64">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Filter by ${skuLabel.toLowerCase()}, name, or ${manufacturerLabel.toLowerCase()}...`}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={typeFilter === option.value ? "default" : "outline"}
                onClick={() => setTypeFilter(option.value)}
              >
                {option.label}
                {typeof option.count === "number" ? (
                  <span className="tabular-nums opacity-80">{option.count}</span>
                ) : null}
              </Button>
            ))}
          </div>
        </div>

        {!loading && data ? (
          <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-3 sm:px-6">
            <SummaryStat label="Duplicate Groups" value={data.summary.totalGroups} />
            <SummaryStat label={`${skuLabel} Matches`} value={data.summary.skuGroupCount} />
            <SummaryStat
              label="Products in Groups"
              value={data.summary.duplicateProductCount}
            />
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => void fetchDuplicates()} />
          ) : !data || data.groups.length === 0 ? (
            <EmptyState
              icon={CopyIcon}
              title={
                debouncedSearch || typeFilter !== "all"
                  ? "No Matching Duplicate Groups"
                  : "No Duplicate Products Found"
              }
              description={
                debouncedSearch || typeFilter !== "all"
                  ? "Try a different filter or clear the search to see all duplicate groups."
                  : `Every ${skuLabel.toLowerCase()} and name + ${manufacturerLabel.toLowerCase()} combination in the catalog is unique.`
              }
              action={
                debouncedSearch || typeFilter !== "all" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("")
                      setTypeFilter("all")
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/products">Back to Products</Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="mx-auto max-w-5xl space-y-4">
              {data.groups.map((group) => (
                <section
                  key={group.id}
                  className="overflow-hidden rounded-xl border bg-background"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={group.type === "sku" ? "default" : "secondary"}>
                          {group.type === "sku" ? `Same ${skuLabel}` : "Same Name"}
                        </Badge>
                        <span className="text-sm font-medium tabular-nums text-muted-foreground">
                          {group.count} products
                        </span>
                      </div>
                      <h2 className="truncate text-sm font-semibold">{group.label}</h2>
                      {group.type === "name" && group.secondaryLabel ? (
                        <p className="text-xs text-muted-foreground">
                          {manufacturerLabel}: {group.secondaryLabel}
                        </p>
                      ) : group.type === "sku" ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          Normalized {skuLabel}: {group.matchKey}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="divide-y">
                    {group.products.map((product) => (
                      <div
                        key={product.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                              {productSku(product)}
                            </span>
                            {product.is_top_seller ? (
                              <Badge variant="outline">Top seller</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-sm font-medium">{productLabel(product)}</p>
                          <p className="text-xs text-muted-foreground">
                            {productBrand(product)}
                            {product.category ? ` · ${product.category}` : ""}
                            {" · "}
                            {formatCatalogMoney(
                              product.unitprice,
                              settings?.currency ?? "INR"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/products" search={{ search: productSku(product) }}>
                              Open in Catalog
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2Icon className="size-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {data.totalPages > 1 ? (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Page <span className="font-semibold text-foreground">{data.page}</span> of{" "}
                    <span className="font-semibold text-foreground">{data.totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1 || loading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
                      disabled={page >= data.totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget ? productLabel(deleteTarget) : "this product"}
              </span>
              {deleteTarget && productSku(deleteTarget) !== "—" ? (
                <>
                  {" "}
                  (<span className="font-mono">{productSku(deleteTarget)}</span>)
                </>
              ) : null}{" "}
              from the catalog. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteProduct()}
              disabled={deleting}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
