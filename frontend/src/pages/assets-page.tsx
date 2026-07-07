import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  DownloadIcon,
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
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEntitlements } from "@/lib/entitlements"
import { API_ORIGIN } from "@/lib/env"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  ASSETS_API_BASE,
  assetsFetch,
  CONDITION_LABELS,
  DEPRECIATION_METHOD_LABELS,
  formatInr,
  LIFECYCLE_STATUS_LABELS,
  populatedRef,
  type Asset,
  type AssetCategory,
  type AssetDepreciationMethod,
  type AssetLifecycleStatus,
  type AssetLocation,
  type AssetStats,
} from "@/lib/assets"

const PAGE_LIMIT = 20
const ALL_FILTER = "__all__"
const NONE_VALUE = "__none__"

interface AssetsResponse {
  assets: Asset[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface EmployeeOption {
  _id: string
  fullName: string
}

type AssetFormState = {
  name: string
  serialNumber: string
  description: string
  categoryId: string
  copies: string
  purchaseDate: string
  purchaseCost: string
  vendorName: string
  invoiceReference: string
  availableForUseDate: string
  locationId: string
  assignedEmployeeId: string
  warrantyExpiryDate: string
  amcExpiryDate: string
  method: AssetDepreciationMethod
  usefulLifeMonths: string
  salvagePercentage: string
  wdvRatePercentage: string
  openingAccumulatedDepreciation: string
}

const emptyForm: AssetFormState = {
  name: "",
  serialNumber: "",
  description: "",
  categoryId: NONE_VALUE,
  copies: "1",
  purchaseDate: "",
  purchaseCost: "",
  vendorName: "",
  invoiceReference: "",
  availableForUseDate: "",
  locationId: NONE_VALUE,
  assignedEmployeeId: NONE_VALUE,
  warrantyExpiryDate: "",
  amcExpiryDate: "",
  method: "straight_line",
  usefulLifeMonths: "60",
  salvagePercentage: "0",
  wdvRatePercentage: "0",
  openingAccumulatedDepreciation: "0",
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

function AssetForm({
  form,
  categories,
  locations,
  employees,
  onChange,
  onCategoryChange,
}: {
  form: AssetFormState
  categories: AssetCategory[]
  locations: AssetLocation[]
  employees: EmployeeOption[]
  onChange: <K extends keyof AssetFormState>(field: K, value: AssetFormState[K]) => void
  onCategoryChange: (categoryId: string) => void
}) {
  return (
    <div className="grid gap-5 px-5 pb-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="asset-name">Asset name</Label>
          <Input
            id="asset-name"
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="MacBook Pro 14, CNC machine..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-serial">Serial number</Label>
          <Input
            id="asset-serial"
            value={form.serialNumber}
            onChange={(event) => onChange("serialNumber", event.target.value)}
            placeholder="Manufacturer serial"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="asset-description">Description</Label>
        <textarea
          id="asset-description"
          rows={3}
          value={form.description}
          onChange={(event) => onChange("description", event.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          placeholder="Model, configuration, notes..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>No Category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-copies">Number of copies</Label>
          <Input
            id="asset-copies"
            type="number"
            min={1}
            max={100}
            value={form.copies}
            onChange={(event) => onChange("copies", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Creates identical records with sequential asset codes (e.g. 20 chairs).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-date">Purchase date</Label>
          <Input
            id="asset-purchase-date"
            type="date"
            value={form.purchaseDate}
            onChange={(event) => onChange("purchaseDate", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-cost">Purchase cost (INR)</Label>
          <Input
            id="asset-purchase-cost"
            type="number"
            min={0}
            value={form.purchaseCost}
            onChange={(event) => onChange("purchaseCost", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-use-date">Available for use</Label>
          <Input
            id="asset-use-date"
            type="date"
            value={form.availableForUseDate}
            onChange={(event) => onChange("availableForUseDate", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Depreciation start; defaults to purchase date.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="asset-vendor">Vendor</Label>
          <Input
            id="asset-vendor"
            value={form.vendorName}
            onChange={(event) => onChange("vendorName", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-invoice-ref">Invoice reference</Label>
          <Input
            id="asset-invoice-ref"
            value={form.invoiceReference}
            onChange={(event) => onChange("invoiceReference", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Location</Label>
          <Select value={form.locationId} onValueChange={(value) => onChange("locationId", value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>No Location</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location._id} value={location._id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Assigned employee</Label>
          <Select
            value={form.assignedEmployeeId}
            onValueChange={(value) => onChange("assignedEmployeeId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee._id} value={employee._id}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="asset-warranty">Warranty expiry</Label>
          <Input
            id="asset-warranty"
            type="date"
            value={form.warrantyExpiryDate}
            onChange={(event) => onChange("warrantyExpiryDate", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-amc">AMC expiry</Label>
          <Input
            id="asset-amc"
            type="date"
            value={form.amcExpiryDate}
            onChange={(event) => onChange("amcExpiryDate", event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">Depreciation</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Inherited from the category; override per asset when needed.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Method</Label>
            <Select
              value={form.method}
              onValueChange={(value) => onChange("method", value as AssetDepreciationMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight_line">{DEPRECIATION_METHOD_LABELS.straight_line}</SelectItem>
                <SelectItem value="written_down_value">{DEPRECIATION_METHOD_LABELS.written_down_value}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-life">Useful life (months)</Label>
            <Input
              id="asset-life"
              type="number"
              min={1}
              value={form.usefulLifeMonths}
              onChange={(event) => onChange("usefulLifeMonths", event.target.value)}
            />
          </div>
          {form.method === "straight_line" ? (
            <div className="grid gap-2">
              <Label htmlFor="asset-salvage">Salvage (% of cost)</Label>
              <Input
                id="asset-salvage"
                type="number"
                min={0}
                max={95}
                value={form.salvagePercentage}
                onChange={(event) => onChange("salvagePercentage", event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="asset-wdv">WDV rate (% per year)</Label>
                <Input
                  id="asset-wdv"
                  type="number"
                  min={0}
                  max={100}
                  value={form.wdvRatePercentage}
                  onChange={(event) => onChange("wdvRatePercentage", event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="asset-salvage-wdv">Salvage floor (% of cost)</Label>
                <Input
                  id="asset-salvage-wdv"
                  type="number"
                  min={0}
                  max={95}
                  value={form.salvagePercentage}
                  onChange={(event) => onChange("salvagePercentage", event.target.value)}
                />
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="asset-opening">Opening accumulated depreciation</Label>
            <Input
              id="asset-opening"
              type="number"
              min={0}
              value={form.openingAccumulatedDepreciation}
              onChange={(event) => onChange("openingAccumulatedDepreciation", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              For assets imported mid-life; already-booked depreciation.
            </p>
          </div>
        </div>
      </div>
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
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<AssetFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/employees?limit=100`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setEmployees(
          (data.employees ?? []).map((employee: { _id: string; fullName: string }) => ({
            _id: employee._id,
            fullName: employee.fullName,
          }))
        )
      }
    } catch {
      // Employee assignment stays available from the detail page.
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (statusFilter !== ALL_FILTER) params.set("lifecycleStatus", statusFilter)
      if (conditionFilter !== ALL_FILTER) params.set("condition", conditionFilter)
      if (categoryFilter !== ALL_FILTER) params.set("categoryId", categoryFilter)
      if (locationFilter !== ALL_FILTER) params.set("locationId", locationFilter)

      const data = await assetsFetch<AssetsResponse>(`?${params}`)
      setAssets(data.assets)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch assets")
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, conditionFilter, categoryFilter, locationFilter])

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

  function openCreateSheet() {
    setForm(emptyForm)
    setSaveError(null)
    setSheetOpen(true)
  }

  function applyCategoryDefaults(categoryId: string) {
    setForm((current) => {
      const category = categories.find((item) => item._id === categoryId)
      if (!category) return { ...current, categoryId }
      return {
        ...current,
        categoryId,
        method: category.depreciationMethod,
        usefulLifeMonths: String(category.usefulLifeMonths),
        salvagePercentage: String(category.salvagePercentage),
        wdvRatePercentage: String(category.wdvRatePercentage),
      }
    })
  }

  async function saveAsset() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name: form.name,
        serialNumber: form.serialNumber,
        description: form.description,
        categoryId: form.categoryId === NONE_VALUE ? null : form.categoryId,
        copies: Number(form.copies) || 1,
        purchaseDate: form.purchaseDate || null,
        purchaseCost: Number(form.purchaseCost) || 0,
        vendorName: form.vendorName,
        invoiceReference: form.invoiceReference,
        availableForUseDate: form.availableForUseDate || null,
        locationId: form.locationId === NONE_VALUE ? null : form.locationId,
        assignedEmployeeId: form.assignedEmployeeId === NONE_VALUE ? null : form.assignedEmployeeId,
        warrantyExpiryDate: form.warrantyExpiryDate || null,
        amcExpiryDate: form.amcExpiryDate || null,
        depreciation: {
          method: form.method,
          usefulLifeMonths: Number(form.usefulLifeMonths) || 60,
          salvagePercentage: Number(form.salvagePercentage) || 0,
          wdvRatePercentage: Number(form.wdvRatePercentage) || 0,
          openingAccumulatedDepreciation: Number(form.openingAccumulatedDepreciation) || 0,
        },
      }

      const data = await assetsFetch<{ assets: Asset[]; created: number }>("", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      setSheetOpen(false)
      toast.success(
        data.created === 1 ? "Asset created as draft" : `${data.created} assets created as drafts`
      )
      await fetchAssets()
      void fetchStats()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to create asset")
    } finally {
      setSaving(false)
    }
  }

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
      toast.error(err instanceof Error ? err.message : "Failed to download register")
    }
  }

  return (
    <>
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
                      <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => void downloadRegister()}>
                      <DownloadIcon className="size-4" />
                      Register
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download the depreciation register as CSV</TooltipContent>
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
                      <TooltipContent>Categories, locations, and asset codes</TooltipContent>
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
                      <TooltipContent>Import assets from CSV or Excel</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={openCreateSheet}>
                          <PlusIcon className="size-4" />
                          New Asset
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
                  {Object.entries(LIFECYCLE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
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
                Showing <span className="font-semibold text-foreground">{visibleRange}</span> of{" "}
                <span className="font-semibold text-foreground">{formatNumber(total)}</span>
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
                  canManageOrganization && !debouncedSearch && statusFilter === ALL_FILTER ? (
                    <Button size="sm" onClick={openCreateSheet}>
                      <PlusIcon className="size-4" />
                      New Asset
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex-1 overflow-auto animate-in fade-in-0 duration-300">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                        onClick={() =>
                          void navigate({ to: "/assets/$id", params: { id: asset._id } })
                        }
                      >
                        <td className="px-5 py-3.5 align-top">
                          <span className="inline-flex rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs font-bold">
                            {asset.assetCode}
                          </span>
                        </td>
                        <td className="max-w-sm px-5 py-3.5 align-top">
                          <p className="line-clamp-1 font-medium">{asset.name}</p>
                          {asset.serialNumber && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              SN {asset.serialNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 align-top text-muted-foreground">
                          {populatedRef(asset.categoryId)?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          {populatedRef(asset.assignedEmployeeId)?.fullName ?? (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 align-top text-muted-foreground">
                          {populatedRef(asset.locationId)?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={lifecycleBadgeVariant(asset.lifecycleStatus)}>
                              {LIFECYCLE_STATUS_LABELS[asset.lifecycleStatus]}
                            </Badge>
                            {asset.lifecycleStatus === "active" && (
                              <Badge variant="outline">{CONDITION_LABELS[asset.condition]}</Badge>
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
                Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>
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
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl">New Asset</SheetTitle>
            <SheetDescription>
              Assets are created as drafts; activate them to start depreciation.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <AssetForm
            form={form}
            categories={categories}
            locations={locations}
            employees={employees}
            onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
            onCategoryChange={applyCategoryDefaults}
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
            <Button onClick={() => void saveAsset()} disabled={saving || !form.name.trim()}>
              {saving && <Spinner data-icon="inline-start" />}
              Create Asset
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
