import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BanknoteIcon,
  CircleCheckIcon,
  FileIcon,
  HistoryIcon,
  MapPinIcon,
  PaperclipIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { DatePicker } from "@/components/date-picker"
import { ErrorState } from "@/components/list-states"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useEntitlements } from "@/lib/entitlements"
import { API_ORIGIN } from "@/lib/env"
import { formatDate, formatDateTime } from "@/lib/format"
import {
  assetsFetch,
  CONDITION_LABELS,
  DEPRECIATION_METHOD_LABELS,
  formatInrExact,
  LIFECYCLE_STATUS_LABELS,
  openAssetAttachment,
  populatedRef,
  uploadAssetAttachment,
  type Asset,
  type AssetActivityEntry,
  type AssetCondition,
  type AssetLocation,
} from "@/lib/assets"

const NONE_VALUE = "__none__"

interface EmployeeOption {
  _id: string
  fullName: string
}

interface AssetDetailResponse {
  asset: Asset
  activity: AssetActivityEntry[]
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

export default function AssetDetailPage() {
  const { id } = useParams({ from: "/assets_/$id" })
  const navigate = useNavigate()
  const { canManageOrganization } = useEntitlements()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [activity, setActivity] = useState<AssetActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [locations, setLocations] = useState<AssetLocation[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const [busyAction, setBusyAction] = useState<string | null>(null)

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustDate, setAdjustDate] = useState(todayInput())
  const [adjustValue, setAdjustValue] = useState("")
  const [adjustReason, setAdjustReason] = useState("")

  const [disposeOpen, setDisposeOpen] = useState(false)
  const [disposeType, setDisposeType] = useState<"sold" | "scrapped">("sold")
  const [disposeDate, setDisposeDate] = useState(todayInput())
  const [disposeAmount, setDisposeAmount] = useState("")
  const [disposeBuyer, setDisposeBuyer] = useState("")
  const [disposeNotes, setDisposeNotes] = useState("")

  const [repairOpen, setRepairOpen] = useState(false)
  const [repairDate, setRepairDate] = useState(todayInput())
  const [repairDescription, setRepairDescription] = useState("")
  const [repairCost, setRepairCost] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const fetchAsset = useCallback(async () => {
    setError(null)
    try {
      const data = await assetsFetch<AssetDetailResponse>(`/${id}`)
      setAsset(data.asset)
      setActivity(data.activity)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch asset")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchAsset()
  }, [fetchAsset])

  useEffect(() => {
    void assetsFetch<{ locations: AssetLocation[] }>("/locations")
      .then((data) => setLocations(data.locations))
      .catch(() => undefined)

    void fetch(`${API_ORIGIN}/api/v1/employees?limit=100`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        setEmployees(
          (data.employees ?? []).map(
            (employee: { _id: string; fullName: string }) => ({
              _id: employee._id,
              fullName: employee.fullName,
            })
          )
        )
      })
      .catch(() => undefined)
  }, [])

  async function runAction(
    action: string,
    request: () => Promise<unknown>,
    successMessage: string
  ) {
    setBusyAction(action)
    try {
      await request()
      toast.success(successMessage)
      await fetchAsset()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAttachmentUpload(file: File | null) {
    if (!file || !asset) return
    setUploadingAttachment(true)
    try {
      const uploaded = await uploadAssetAttachment(file)
      await assetsFetch(`/${asset._id}/attachments`, {
        method: "POST",
        body: JSON.stringify(uploaded),
      })
      toast.success("Attachment added")
      await fetchAsset()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload attachment"
      )
    } finally {
      setUploadingAttachment(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Assets", href: "/assets" },
            { label: "Asset" },
          ]}
        />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !asset) {
    return (
      <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Assets", href: "/assets" },
            { label: "Asset" },
          ]}
        />
        <ErrorState
          message={error ?? "Asset not found"}
          onRetry={() => void fetchAsset()}
        />
      </AppLayout>
    )
  }

  const category = populatedRef(asset.categoryId)
  const location = populatedRef(asset.locationId)
  const employee = populatedRef(asset.assignedEmployeeId)
  const isDisposed =
    asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped"
  const isDraft = asset.lifecycleStatus === "draft"
  const accumulatedDepreciation =
    Math.round((asset.purchaseCost - asset.currentBookValue) * 100) / 100

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Assets", href: "/assets" },
          { label: asset.assetCode },
        ]}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
                <Link to="/assets">
                  <ArrowLeftIcon className="size-4" />
                  Back to Assets
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {asset.name}
                </h1>
                <span className="inline-flex rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs font-bold">
                  {asset.assetCode}
                </span>
                <Badge
                  variant={
                    asset.lifecycleStatus === "active" ? "default" : "secondary"
                  }
                >
                  {LIFECYCLE_STATUS_LABELS[asset.lifecycleStatus]}
                </Badge>
                {!isDisposed && !isDraft && (
                  <Badge variant="outline">
                    {CONDITION_LABELS[asset.condition]}
                  </Badge>
                )}
              </div>
              {asset.description && (
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {asset.description}
                </p>
              )}
            </div>
            {canManageOrganization && (
              <div className="flex flex-wrap items-center gap-2">
                {isDraft && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void runAction(
                          "activate",
                          () =>
                            assetsFetch(`/${asset._id}/activate`, {
                              method: "POST",
                              body: "{}",
                            }),
                          "Asset activated — depreciation schedule generated"
                        )
                      }
                      disabled={busyAction !== null}
                    >
                      {busyAction === "activate" && (
                        <Spinner data-icon="inline-start" />
                      )}
                      <CircleCheckIcon className="size-4" />
                      Activate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      disabled={busyAction !== null}
                    >
                      <Trash2Icon className="size-4" />
                      Delete Draft
                    </Button>
                  </>
                )}
                {asset.lifecycleStatus === "active" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdjustDate(todayInput())
                        setAdjustValue("")
                        setAdjustReason("")
                        setAdjustOpen(true)
                      }}
                    >
                      <BanknoteIcon className="size-4" />
                      Adjust Value
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDisposeType("sold")
                        setDisposeDate(todayInput())
                        setDisposeAmount("")
                        setDisposeBuyer("")
                        setDisposeNotes("")
                        setDisposeOpen(true)
                      }}
                    >
                      <ArchiveIcon className="size-4" />
                      Dispose
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {isDisposed && asset.disposal && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold">
                {asset.disposal.type === "sold" ? "Sold" : "Scrapped"} on{" "}
                {formatDate(asset.disposal.date)}
              </p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">
                    Book value at disposal:{" "}
                  </span>
                  <span className="font-medium">
                    {formatInrExact(asset.disposal.bookValueAtDisposal)}
                  </span>
                </p>
                {asset.disposal.type === "sold" && (
                  <p>
                    <span className="text-muted-foreground">Sale amount: </span>
                    <span className="font-medium">
                      {formatInrExact(asset.disposal.saleAmount)}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">
                    {asset.disposal.gainLoss >= 0 ? "Gain: " : "Loss: "}
                  </span>
                  <span
                    className={
                      asset.disposal.gainLoss >= 0
                        ? "font-medium text-primary"
                        : "font-medium text-destructive"
                    }
                  >
                    {formatInrExact(Math.abs(asset.disposal.gainLoss))}
                  </span>
                </p>
                {asset.disposal.buyerName && (
                  <p>
                    <span className="text-muted-foreground">Buyer: </span>
                    <span className="font-medium">
                      {asset.disposal.buyerName}
                    </span>
                  </p>
                )}
                {asset.disposal.notes && (
                  <p className="text-muted-foreground sm:col-span-3">
                    {asset.disposal.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Purchase Cost
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {formatInrExact(asset.purchaseCost)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Accumulated Depreciation
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {formatInrExact(accumulatedDepreciation)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-4 py-3.5">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Current Book Value
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">
                {formatInrExact(asset.currentBookValue)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-xl border">
                <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                  Details
                </div>
                <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
                  <DetailRow label="Category" value={category?.name ?? "—"} />
                  <DetailRow
                    label="Serial number"
                    value={asset.serialNumber || "—"}
                  />
                  <DetailRow
                    label="Purchase date"
                    value={formatDate(asset.purchaseDate)}
                  />
                  <DetailRow
                    label="Available for use"
                    value={formatDate(
                      asset.availableForUseDate ?? asset.purchaseDate
                    )}
                  />
                  <DetailRow label="Vendor" value={asset.vendorName || "—"} />
                  <DetailRow
                    label="Invoice reference"
                    value={asset.invoiceReference || "—"}
                  />
                  <DetailRow
                    label="Warranty expiry"
                    value={formatDate(asset.warrantyExpiryDate)}
                  />
                  <DetailRow
                    label="AMC expiry"
                    value={formatDate(asset.amcExpiryDate)}
                  />
                  <DetailRow
                    label="Depreciation method"
                    value={
                      DEPRECIATION_METHOD_LABELS[asset.depreciation.method]
                    }
                  />
                  <DetailRow
                    label="Useful life"
                    value={`${asset.depreciation.usefulLifeMonths} months`}
                  />
                  {asset.depreciation.method === "straight_line" ? (
                    <DetailRow
                      label="Salvage"
                      value={`${asset.depreciation.salvagePercentage}% of cost`}
                    />
                  ) : (
                    <DetailRow
                      label="WDV rate"
                      value={`${asset.depreciation.wdvRatePercentage}% per year`}
                    />
                  )}
                  {asset.depreciation.openingAccumulatedDepreciation > 0 && (
                    <DetailRow
                      label="Opening accumulated depreciation"
                      value={formatInrExact(
                        asset.depreciation.openingAccumulatedDepreciation
                      )}
                    />
                  )}
                </div>
              </section>

              <section className="rounded-xl border">
                <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                  Depreciation Schedule
                </div>
                {asset.depreciationSchedule.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {isDraft
                      ? "The schedule is generated when the asset is activated."
                      : "No depreciation schedule."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                          <th className="px-4 py-2">Period</th>
                          <th className="px-4 py-2 text-right">Depreciation</th>
                          <th className="px-4 py-2 text-right">Accumulated</th>
                          <th className="px-4 py-2 text-right">Book Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asset.depreciationSchedule.map((row, index) => (
                          <tr key={index} className="border-b last:border-0">
                            <td className="px-4 py-2.5">
                              {formatDate(row.periodStartDate)} –{" "}
                              {formatDate(row.periodEndDate)}
                              {row.source === "adjustment" && (
                                <Badge variant="outline" className="ml-2">
                                  Adjusted
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {formatInrExact(row.depreciationAmount)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                              {formatInrExact(row.accumulatedDepreciation)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                              {formatInrExact(row.bookValueAtEnd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {asset.valueAdjustments.length > 0 && (
                <section className="rounded-xl border">
                  <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                    Value Adjustments
                  </div>
                  <div className="divide-y">
                    {asset.valueAdjustments.map((adjustment) => (
                      <div
                        key={adjustment.id}
                        className="flex items-start justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {formatInrExact(adjustment.previousBookValue)} →{" "}
                            {formatInrExact(adjustment.newValue)}
                          </p>
                          {adjustment.reason && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {adjustment.reason}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(adjustment.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-xl border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <WrenchIcon className="size-4 text-muted-foreground" />
                    Repairs
                  </span>
                  {!isDisposed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRepairDate(todayInput())
                        setRepairDescription("")
                        setRepairCost("")
                        setRepairOpen(true)
                      }}
                    >
                      <PlusIcon className="size-4" />
                      Log Repair
                    </Button>
                  )}
                </div>
                {asset.repairs.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No repairs logged.
                  </p>
                ) : (
                  <div className="divide-y">
                    {[...asset.repairs].reverse().map((repair) => (
                      <div
                        key={repair.id}
                        className="flex items-start justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {repair.description}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(repair.date)}
                            {repair.cost > 0 &&
                              ` · ${formatInrExact(repair.cost)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <PaperclipIcon className="size-4 text-muted-foreground" />
                    Attachments
                  </span>
                  {canManageOrganization && (
                    <Label className="inline-flex cursor-pointer">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-muted">
                        {uploadingAttachment ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <PlusIcon className="size-3.5" />
                        )}
                        Add File
                      </span>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
                        className="sr-only"
                        disabled={uploadingAttachment}
                        onChange={(event) => {
                          void handleAttachmentUpload(
                            event.target.files?.[0] ?? null
                          )
                          event.target.value = ""
                        }}
                      />
                    </Label>
                  )}
                </div>
                {asset.attachments.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No attachments. Add the purchase invoice, photos, or
                    warranty card.
                  </p>
                ) : (
                  <div className="divide-y">
                    {asset.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2 text-left text-sm font-medium hover:underline"
                          onClick={() =>
                            void openAssetAttachment(
                              attachment.key,
                              attachment.originalName
                            ).catch((err) =>
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to open attachment"
                              )
                            )
                          }
                        >
                          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {attachment.originalName || attachment.key}
                          </span>
                        </button>
                        {canManageOrganization && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            onClick={() =>
                              void runAction(
                                `remove-attachment-${attachment.id}`,
                                () =>
                                  assetsFetch(
                                    `/${asset._id}/attachments/${attachment.id}`,
                                    {
                                      method: "DELETE",
                                    }
                                  ),
                                "Attachment removed"
                              )
                            }
                            disabled={busyAction !== null}
                          >
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Remove attachment</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border">
                <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                  Custody
                </div>
                <div className="space-y-4 p-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      <UserIcon className="size-3.5 text-muted-foreground" />
                      Assigned employee
                    </Label>
                    {canManageOrganization && !isDisposed ? (
                      <Select
                        value={employee?._id ?? NONE_VALUE}
                        onValueChange={(value) =>
                          void runAction(
                            "assign",
                            () =>
                              assetsFetch(`/${asset._id}/assign`, {
                                method: "POST",
                                body: JSON.stringify({
                                  employeeId:
                                    value === NONE_VALUE ? null : value,
                                }),
                              }),
                            "Assignment updated"
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                          {employees.map((option) => (
                            <SelectItem key={option._id} value={option._id}>
                              {option.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">
                        {employee?.fullName ?? "Unassigned"}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPinIcon className="size-3.5 text-muted-foreground" />
                      Location
                    </Label>
                    {canManageOrganization && !isDisposed ? (
                      <Select
                        value={location?._id ?? NONE_VALUE}
                        onValueChange={(value) =>
                          void runAction(
                            "move",
                            () =>
                              assetsFetch(`/${asset._id}/move`, {
                                method: "POST",
                                body: JSON.stringify({
                                  locationId:
                                    value === NONE_VALUE ? null : value,
                                }),
                              }),
                            "Location updated"
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            No Location
                          </SelectItem>
                          {locations.map((option) => (
                            <SelectItem key={option._id} value={option._id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">
                        {location?.name ?? "—"}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Condition</Label>
                    {canManageOrganization && !isDisposed ? (
                      <Select
                        value={asset.condition}
                        onValueChange={(value) =>
                          void runAction(
                            "condition",
                            () =>
                              assetsFetch(`/${asset._id}/condition`, {
                                method: "POST",
                                body: JSON.stringify({
                                  condition: value as AssetCondition,
                                }),
                              }),
                            "Condition updated"
                          )
                        }
                        disabled={busyAction !== null}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONDITION_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">
                        {CONDITION_LABELS[asset.condition]}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border">
                <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">
                  <HistoryIcon className="size-4 text-muted-foreground" />
                  Activity
                </div>
                {activity.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No activity yet.
                  </p>
                ) : (
                  <div className="max-h-96 divide-y overflow-y-auto">
                    {activity.map((entry) => (
                      <div key={entry._id} className="px-4 py-3">
                        <p className="text-sm">{entry.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {entry.actorName ? `${entry.actorName} · ` : ""}
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Asset Value</DialogTitle>
            <DialogDescription>
              Revalue the asset as of a date. The remaining schedule is
              recalculated from the new value.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Adjustment date</Label>
              <DatePicker value={adjustDate} onChange={setAdjustDate} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-value">New value (INR)</Label>
              <Input
                id="adjust-value"
                type="number"
                min={0}
                value={adjustValue}
                onChange={(event) => setAdjustValue(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current book value: {formatInrExact(asset.currentBookValue)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input
                id="adjust-reason"
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                placeholder="Damage, revaluation..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(false)}
              disabled={busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                void runAction(
                  "adjust",
                  () =>
                    assetsFetch(`/${asset._id}/adjust-value`, {
                      method: "POST",
                      body: JSON.stringify({
                        date: adjustDate,
                        newValue: Number(adjustValue),
                        reason: adjustReason,
                      }),
                    }),
                  "Asset value adjusted"
                ).then((success) => {
                  if (success) setAdjustOpen(false)
                })
              }
              disabled={busyAction !== null || adjustValue.trim() === ""}
            >
              {busyAction === "adjust" && <Spinner data-icon="inline-start" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispose Asset</DialogTitle>
            <DialogDescription>
              Record a sale or scrapping. The gain or loss is computed against
              the book value at the disposal date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Disposal type</Label>
                <Select
                  value={disposeType}
                  onValueChange={(value) =>
                    setDisposeType(value as "sold" | "scrapped")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="scrapped">Scrapped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Disposal date</Label>
                <DatePicker value={disposeDate} onChange={setDisposeDate} />
              </div>
            </div>
            {disposeType === "sold" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="dispose-amount">Sale amount (INR)</Label>
                  <Input
                    id="dispose-amount"
                    type="number"
                    min={0}
                    value={disposeAmount}
                    onChange={(event) => setDisposeAmount(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dispose-buyer">Buyer</Label>
                  <Input
                    id="dispose-buyer"
                    value={disposeBuyer}
                    onChange={(event) => setDisposeBuyer(event.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="dispose-notes">Notes</Label>
              <Input
                id="dispose-notes"
                value={disposeNotes}
                onChange={(event) => setDisposeNotes(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current book value: {formatInrExact(asset.currentBookValue)}.
              Disposal is permanent — the asset can no longer be edited.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisposeOpen(false)}
              disabled={busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                void runAction(
                  "dispose",
                  () =>
                    assetsFetch(`/${asset._id}/dispose`, {
                      method: "POST",
                      body: JSON.stringify({
                        type: disposeType,
                        date: disposeDate,
                        saleAmount: Number(disposeAmount) || 0,
                        buyerName: disposeBuyer,
                        notes: disposeNotes,
                      }),
                    }),
                  disposeType === "sold"
                    ? "Asset marked as sold"
                    : "Asset scrapped"
                ).then((success) => {
                  if (success) setDisposeOpen(false)
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "dispose" && <Spinner data-icon="inline-start" />}
              {disposeType === "sold" ? "Mark as Sold" : "Scrap Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={repairOpen} onOpenChange={setRepairOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Repair</DialogTitle>
            <DialogDescription>
              Record maintenance or repair work done on this asset.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Repair date</Label>
                <DatePicker value={repairDate} onChange={setRepairDate} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repair-cost">Cost (INR)</Label>
                <Input
                  id="repair-cost"
                  type="number"
                  min={0}
                  value={repairCost}
                  onChange={(event) => setRepairCost(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repair-description">Description</Label>
              <Input
                id="repair-description"
                value={repairDescription}
                onChange={(event) => setRepairDescription(event.target.value)}
                placeholder="Replaced battery, serviced motor..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRepairOpen(false)}
              disabled={busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                void runAction(
                  "repair",
                  () =>
                    assetsFetch(`/${asset._id}/repairs`, {
                      method: "POST",
                      body: JSON.stringify({
                        date: repairDate,
                        description: repairDescription,
                        cost: Number(repairCost) || 0,
                      }),
                    }),
                  "Repair logged"
                ).then((success) => {
                  if (success) setRepairOpen(false)
                })
              }
              disabled={busyAction !== null || !repairDescription.trim()}
            >
              {busyAction === "repair" && <Spinner data-icon="inline-start" />}
              Log Repair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Asset</DialogTitle>
            <DialogDescription>
              This permanently removes {asset.assetCode} and its activity log.
              Only draft assets can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setBusyAction("delete")
                assetsFetch(`/${asset._id}`, { method: "DELETE" })
                  .then(() => {
                    toast.success("Draft asset deleted")
                    void navigate({ to: "/assets" })
                  })
                  .catch((err) => {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to delete asset"
                    )
                    setBusyAction(null)
                  })
              }}
              disabled={busyAction !== null}
            >
              {busyAction === "delete" && <Spinner data-icon="inline-start" />}
              Delete Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
