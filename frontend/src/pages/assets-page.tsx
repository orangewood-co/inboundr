import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  DownloadIcon,
  ImageIcon,
  MonitorCogIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldAlertIcon,
  UploadIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { AssetImage } from "@/components/asset-image"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEntitlements } from "@/lib/entitlements"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  ASSETS_API_BASE,
  assetsFetch,
  CONDITION_LABELS,
  formatInr,
  LIFECYCLE_STATUS_LABELS,
  populatedRef,
  type Asset,
  type AssetCategory,
  type AssetLifecycleStatus,
  type AssetLocation,
  type AssetStats,
} from "@/lib/assets"

const PAGE_LIMIT = 20
const ALL_FILTER = "__all__"

interface AssetsResponse {
  assets: Asset[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function lifecycleBadgeVariant(status: AssetLifecycleStatus) {
  if (status === "active") return "default" as const
  if (status === "draft") return "outline" as const
  return "secondary" as const
}

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: string
  icon: typeof ArchiveIcon
  loading: boolean
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
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

export default function AssetsPage() {
  const navigate = useNavigate()
  const { canManageOrganization } = useEntitlements()

  const [assets, setAssets] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [conditionFilter, setConditionFilter] = useState(ALL_FILTER)
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER)
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<AssetStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [locations, setLocations] = useState<AssetLocation[]>([])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      setStats(await assetsFetch<AssetStats>("/stats"))
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [categoriesData, locationsData] = await Promise.all([
        assetsFetch<{ categories: AssetCategory[] }>("/categories"),
        assetsFetch<{ locations: AssetLocation[] }>("/locations"),
      ])
      setCategories(categoriesData.categories)
      setLocations(locationsData.locations)
    } catch {
      // Reference data is non-critical for the list view.
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (statusFilter !== ALL_FILTER)
        params.set("lifecycleStatus", statusFilter)
      if (conditionFilter !== ALL_FILTER)
        params.set("condition", conditionFilter)
      if (categoryFilter !== ALL_FILTER)
        params.set("categoryId", categoryFilter)
      if (locationFilter !== ALL_FILTER)
        params.set("locationId", locationFilter)

      const data = await assetsFetch<AssetsResponse>(`?${params}`)
      setAssets(data.assets)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch assets")
    } finally {
      setLoading(false)
    }
  }, [
    page,
    debouncedSearch,
    statusFilter,
    conditionFilter,
    categoryFilter,
    locationFilter,
  ])

  useEffect(() => {
    void fetchStats()
    void fetchReferenceData()
  }, [fetchStats, fetchReferenceData])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    void fetchAssets()
  }, [fetchAssets])

  const visibleRange = useMemo(() => {
    if (total === 0) return "0"
    const start = (page - 1) * PAGE_LIMIT + 1
    const end = Math.min(page * PAGE_LIMIT, total)
    return `${start}-${end}`
  }, [page, total])

  async function downloadRegister() {
    try {
      const asOf = new Date().toISOString().slice(0, 10)
      const response = await fetch(
        `${ASSETS_API_BASE}/report/depreciation-register?format=csv&asOf=${asOf}`,
        { credentials: "include" }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to download register")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `depreciation-register-${asOf}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download register"
      )
    }
  }

  return (
    <AppLayout>
      <SiteHeader />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageToolbar
          icon={MonitorCogIcon}
          title="Assets"
          count={loading ? null : total}
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => void fetchAssets()}
                    disabled={loading}
                  >
                    <RefreshCwIcon
                      className={cn("size-4", loading && "animate-spin")}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadRegister()}
                  >
                    <DownloadIcon className="size-4" />
                    Register
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Download the depreciation register as CSV
                </TooltipContent>
              </Tooltip>
              {canManageOrganization && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/assets/settings">
                          <Settings2Icon className="size-4" />
                          Setup
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Categories, locations, and asset codes
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/assets/import">
                          <UploadIcon className="size-4" />
                          Import
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Import assets from CSV or Excel
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild size="sm">
                        <Link to="/assets/new">
                          <PlusIcon className="size-4" />
                          New Asset
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Register a new asset</TooltipContent>
                  </Tooltip>
                </>
              )}
            </>
          }
        />

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total Assets"
              value={formatNumber(stats?.totalAssets ?? 0)}
              icon={ArchiveIcon}
              loading={statsLoading}
            />
            <StatCard
              label="Purchase Cost"
              value={formatInr(stats?.totalPurchaseCost ?? 0)}
              icon={CircleDollarSignIcon}
              loading={statsLoading}
            />
            <StatCard
              label="Current Book Value"
              value={formatInr(stats?.currentBookValue ?? 0)}
              icon={CircleDollarSignIcon}
              loading={statsLoading}
            />
            <StatCard
              label="In Repair"
              value={formatNumber(stats?.inRepair ?? 0)}
              icon={WrenchIcon}
              loading={statsLoading}
            />
            <StatCard
              label="Warranty Expiring 90d"
              value={formatNumber(stats?.warrantyExpiringSoon ?? 0)}
              icon={ShieldAlertIcon}
              loading={statsLoading}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 border-y px-4 py-3">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, code, serial, vendor..."
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Statuses</SelectItem>
                {Object.entries(LIFECYCLE_STATUS_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <Select
              value={conditionFilter}
              onValueChange={(value) => {
                setConditionFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Conditions</SelectItem>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={locationFilter}
              onValueChange={(value) => {
                setLocationFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location._id} value={location._id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto shrink-0 text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {visibleRange}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(total)}
              </span>
            </span>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => void fetchAssets()} />
          ) : loading ? (
            <ListSkeleton rows={8} columns={6} />
          ) : assets.length === 0 ? (
            <EmptyState
              icon={ArchiveIcon}
              title={
                debouncedSearch || statusFilter !== ALL_FILTER
                  ? "No Assets Match These Filters"
                  : "No Assets in the Register Yet"
              }
              description={
                debouncedSearch || statusFilter !== ALL_FILTER
                  ? "Try a different search or clear the filters."
                  : "Register the first asset and it will appear in this table immediately."
              }
              action={
                canManageOrganization &&
                !debouncedSearch &&
                statusFilter === ALL_FILTER ? (
                  <Button asChild size="sm">
                    <Link to="/assets/new">
                      <PlusIcon className="size-4" />
                      New Asset
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex-1 animate-in overflow-auto duration-300 fade-in-0">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    <th className="px-5 py-2.5">Code</th>
                    <th className="px-5 py-2.5">Asset</th>
                    <th className="px-5 py-2.5">Category</th>
                    <th className="px-5 py-2.5">Assigned To</th>
                    <th className="px-5 py-2.5">Location</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Cost</th>
                    <th className="px-5 py-2.5 text-right">Book Value</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset._id}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                      onClick={() =>
                        void navigate({
                          to: "/assets/$id",
                          params: { id: asset._id },
                        })
                      }
                    >
                      <td className="px-5 py-3.5 align-top">
                        <span className="inline-flex rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs font-bold">
                          {asset.assetCode}
                        </span>
                      </td>
                      <td className="max-w-sm px-5 py-3.5 align-top">
                        <div className="flex items-center gap-3">
                          {asset.images?.[0] ? (
                            <AssetImage
                              imageKey={asset.images[0].key}
                              alt={asset.name}
                              className="size-9 shrink-0 rounded-md border"
                            />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                              <ImageIcon className="size-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">
                              {asset.name}
                            </p>
                            {asset.serialNumber && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                SN {asset.serialNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top text-muted-foreground">
                        {populatedRef(asset.categoryId)?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        {populatedRef(asset.assignedEmployeeId)?.fullName ?? (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 align-top text-muted-foreground">
                        {populatedRef(asset.locationId)?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={lifecycleBadgeVariant(
                              asset.lifecycleStatus
                            )}
                          >
                            {LIFECYCLE_STATUS_LABELS[asset.lifecycleStatus]}
                          </Badge>
                          {asset.lifecycleStatus === "active" && (
                            <Badge variant="outline">
                              {CONDITION_LABELS[asset.condition]}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right align-top font-medium tabular-nums">
                        {formatInr(asset.purchaseCost)}
                      </td>
                      <td className="px-5 py-3.5 text-right align-top font-semibold tabular-nums">
                        {formatInr(asset.currentBookValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {totalPages}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeftIcon className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages || loading}
              >
                Next
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
