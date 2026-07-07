import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ClipboardListIcon,
  MapPinIcon,
  ReceiptTextIcon,
  TrendingDownIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { DatePicker } from "@/components/date-picker"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { API_ORIGIN } from "@/lib/env"
import {
  assetsFetch,
  DEPRECIATION_METHOD_LABELS,
  formatInr,
  type Asset,
  type AssetCategory,
  type AssetDepreciationMethod,
  type AssetLocation,
} from "@/lib/assets"

const NONE_VALUE = "__none__"

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

function formatCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ArchiveIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4.5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export default function AssetNewPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<AssetFormState>(emptyForm)
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [locations, setLocations] = useState<AssetLocation[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [codePreview, setCodePreview] = useState<{
    prefix: string
    nextSequence: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    void assetsFetch<{ categories: AssetCategory[] }>("/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => undefined)
    void assetsFetch<{ locations: AssetLocation[] }>("/locations")
      .then((data) => setLocations(data.locations))
      .catch(() => undefined)
    void assetsFetch<{ codePrefix: string; nextSequence: number }>("/settings")
      .then((data) =>
        setCodePreview({
          prefix: data.codePrefix,
          nextSequence: data.nextSequence,
        })
      )
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

  function onChange<K extends keyof AssetFormState>(
    field: K,
    value: AssetFormState[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }))
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

  const copies = Math.min(
    100,
    Math.max(1, Math.round(Number(form.copies) || 1))
  )
  const selectedCategory = categories.find(
    (item) => item._id === form.categoryId
  )

  const codeRange = useMemo(() => {
    if (!codePreview) return null
    const first = formatCode(codePreview.prefix, codePreview.nextSequence)
    if (copies === 1) return first
    return `${first} – ${formatCode(codePreview.prefix, codePreview.nextSequence + copies - 1)}`
  }, [codePreview, copies])

  async function createAsset() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name: form.name,
        serialNumber: form.serialNumber,
        description: form.description,
        categoryId: form.categoryId === NONE_VALUE ? null : form.categoryId,
        copies,
        purchaseDate: form.purchaseDate || null,
        purchaseCost: Number(form.purchaseCost) || 0,
        vendorName: form.vendorName,
        invoiceReference: form.invoiceReference,
        availableForUseDate: form.availableForUseDate || null,
        locationId: form.locationId === NONE_VALUE ? null : form.locationId,
        assignedEmployeeId:
          form.assignedEmployeeId === NONE_VALUE
            ? null
            : form.assignedEmployeeId,
        warrantyExpiryDate: form.warrantyExpiryDate || null,
        amcExpiryDate: form.amcExpiryDate || null,
        depreciation: {
          method: form.method,
          usefulLifeMonths: Number(form.usefulLifeMonths) || 60,
          salvagePercentage: Number(form.salvagePercentage) || 0,
          wdvRatePercentage: Number(form.wdvRatePercentage) || 0,
          openingAccumulatedDepreciation:
            Number(form.openingAccumulatedDepreciation) || 0,
        },
      }

      const data = await assetsFetch<{ assets: Asset[]; created: number }>("", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      toast.success(
        data.created === 1
          ? "Asset created as draft"
          : `${data.created} assets created as drafts`
      )
      if (data.created === 1 && data.assets[0]) {
        void navigate({ to: "/assets/$id", params: { id: data.assets[0]._id } })
      } else {
        void navigate({ to: "/assets" })
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to create asset"
      )
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Assets", href: "/assets" }, { label: "New" }]}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
              <Link to="/assets">
                <ArrowLeftIcon className="size-4" />
                Back to Assets
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">New Asset</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Register an asset in the register. It is created as a draft —
              activate it from the detail page to generate the depreciation
              schedule.
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_19rem]">
            <FieldGroup className="min-w-0">
              <FormSection
                icon={ClipboardListIcon}
                title="Details"
                description="What the asset is and how it is identified."
              >
                <FieldGroup className="gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="asset-name">Asset name</FieldLabel>
                      <Input
                        id="asset-name"
                        value={form.name}
                        onChange={(event) =>
                          onChange("name", event.target.value)
                        }
                        placeholder="MacBook Pro 14, CNC machine..."
                        autoFocus
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-serial">
                        Serial number
                      </FieldLabel>
                      <Input
                        id="asset-serial"
                        value={form.serialNumber}
                        onChange={(event) =>
                          onChange("serialNumber", event.target.value)
                        }
                        placeholder="Manufacturer serial"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="asset-description">
                      Description
                    </FieldLabel>
                    <textarea
                      id="asset-description"
                      rows={3}
                      value={form.description}
                      onChange={(event) =>
                        onChange("description", event.target.value)
                      }
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="Model, configuration, notes..."
                    />
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Category</FieldLabel>
                      <Select
                        value={form.categoryId}
                        onValueChange={applyCategoryDefaults}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="No category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            No Category
                          </SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category._id} value={category._id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Selecting a category fills in its depreciation defaults.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-copies">
                        Number of copies
                      </FieldLabel>
                      <Input
                        id="asset-copies"
                        type="number"
                        min={1}
                        max={100}
                        value={form.copies}
                        onChange={(event) =>
                          onChange("copies", event.target.value)
                        }
                      />
                      <FieldDescription>
                        Creates identical records with sequential asset codes
                        (e.g. 20 chairs).
                      </FieldDescription>
                    </Field>
                  </div>
                </FieldGroup>
              </FormSection>

              <FormSection
                icon={ReceiptTextIcon}
                title="Purchase"
                description="Acquisition details used for the register and depreciation."
              >
                <FieldGroup className="gap-5">
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>Purchase date</FieldLabel>
                      <DatePicker
                        value={form.purchaseDate}
                        onChange={(value) => onChange("purchaseDate", value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-purchase-cost">
                        Purchase cost (INR)
                      </FieldLabel>
                      <Input
                        id="asset-purchase-cost"
                        type="number"
                        min={0}
                        value={form.purchaseCost}
                        onChange={(event) =>
                          onChange("purchaseCost", event.target.value)
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Available for use</FieldLabel>
                      <DatePicker
                        value={form.availableForUseDate}
                        onChange={(value) =>
                          onChange("availableForUseDate", value)
                        }
                      />
                      <FieldDescription>
                        Depreciation start; defaults to the purchase date.
                      </FieldDescription>
                    </Field>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="asset-vendor">Vendor</FieldLabel>
                      <Input
                        id="asset-vendor"
                        value={form.vendorName}
                        onChange={(event) =>
                          onChange("vendorName", event.target.value)
                        }
                        placeholder="Supplier or seller"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="asset-invoice-ref">
                        Invoice reference
                      </FieldLabel>
                      <Input
                        id="asset-invoice-ref"
                        value={form.invoiceReference}
                        onChange={(event) =>
                          onChange("invoiceReference", event.target.value)
                        }
                        placeholder="Bill or invoice number"
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </FormSection>

              <FormSection
                icon={TrendingDownIcon}
                title="Depreciation"
                description="Inherited from the category; override per asset when needed."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Method</FieldLabel>
                    <Select
                      value={form.method}
                      onValueChange={(value) =>
                        onChange("method", value as AssetDepreciationMethod)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight_line">
                          {DEPRECIATION_METHOD_LABELS.straight_line}
                        </SelectItem>
                        <SelectItem value="written_down_value">
                          {DEPRECIATION_METHOD_LABELS.written_down_value}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="asset-life">
                      Useful life (months)
                    </FieldLabel>
                    <Input
                      id="asset-life"
                      type="number"
                      min={1}
                      value={form.usefulLifeMonths}
                      onChange={(event) =>
                        onChange("usefulLifeMonths", event.target.value)
                      }
                    />
                  </Field>
                  {form.method === "straight_line" ? (
                    <Field>
                      <FieldLabel htmlFor="asset-salvage">
                        Salvage (% of cost)
                      </FieldLabel>
                      <Input
                        id="asset-salvage"
                        type="number"
                        min={0}
                        max={95}
                        value={form.salvagePercentage}
                        onChange={(event) =>
                          onChange("salvagePercentage", event.target.value)
                        }
                      />
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="asset-wdv">
                          WDV rate (% per year)
                        </FieldLabel>
                        <Input
                          id="asset-wdv"
                          type="number"
                          min={0}
                          max={100}
                          value={form.wdvRatePercentage}
                          onChange={(event) =>
                            onChange("wdvRatePercentage", event.target.value)
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="asset-salvage-wdv">
                          Salvage floor (% of cost)
                        </FieldLabel>
                        <Input
                          id="asset-salvage-wdv"
                          type="number"
                          min={0}
                          max={95}
                          value={form.salvagePercentage}
                          onChange={(event) =>
                            onChange("salvagePercentage", event.target.value)
                          }
                        />
                      </Field>
                    </>
                  )}
                  <Field>
                    <FieldLabel htmlFor="asset-opening">
                      Opening accumulated depreciation
                    </FieldLabel>
                    <Input
                      id="asset-opening"
                      type="number"
                      min={0}
                      value={form.openingAccumulatedDepreciation}
                      onChange={(event) =>
                        onChange(
                          "openingAccumulatedDepreciation",
                          event.target.value
                        )
                      }
                    />
                    <FieldDescription>
                      For assets imported mid-life; depreciation already booked
                      elsewhere.
                    </FieldDescription>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={MapPinIcon}
                title="Custody & Coverage"
                description="Who holds the asset, where it lives, and warranty cover."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Location</FieldLabel>
                    <Select
                      value={form.locationId}
                      onValueChange={(value) => onChange("locationId", value)}
                    >
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
                  </Field>
                  <Field>
                    <FieldLabel>Assigned employee</FieldLabel>
                    <Select
                      value={form.assignedEmployeeId}
                      onValueChange={(value) =>
                        onChange("assignedEmployeeId", value)
                      }
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
                  </Field>
                  <Field>
                    <FieldLabel>Warranty expiry</FieldLabel>
                    <DatePicker
                      value={form.warrantyExpiryDate}
                      onChange={(value) =>
                        onChange("warrantyExpiryDate", value)
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>AMC expiry</FieldLabel>
                    <DatePicker
                      value={form.amcExpiryDate}
                      onChange={(value) => onChange("amcExpiryDate", value)}
                    />
                  </Field>
                </div>
              </FormSection>
            </FieldGroup>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 border-b px-5 py-3.5">
                  <ArchiveIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Summary</h2>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <SummaryRow
                    label={copies === 1 ? "Asset code" : "Asset codes"}
                    value={
                      codeRange ? (
                        <span className="font-mono text-xs font-bold">
                          {codeRange}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <SummaryRow label="Copies" value={copies} />
                  <SummaryRow
                    label="Category"
                    value={selectedCategory?.name ?? "None"}
                  />
                  <SummaryRow
                    label="Purchase cost"
                    value={
                      form.purchaseCost
                        ? formatInr(Number(form.purchaseCost))
                        : "—"
                    }
                  />
                  <SummaryRow
                    label="Method"
                    value={DEPRECIATION_METHOD_LABELS[form.method]}
                  />
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Created as a draft. Activate the asset from its detail page
                    to generate the depreciation schedule and start tracking
                    book value.
                  </p>
                </div>
                <div className="space-y-3 border-t bg-muted/30 px-5 py-4">
                  {saveError && (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {saveError}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => void createAsset()}
                    disabled={saving || !form.name.trim()}
                  >
                    {saving && <Spinner data-icon="inline-start" />}
                    {copies === 1 ? "Create Asset" : `Create ${copies} Assets`}
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/assets">Cancel</Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
