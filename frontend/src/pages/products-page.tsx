import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BoxIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit3Icon,
  FileSpreadsheetIcon,
  IndianRupeeIcon,
  LoaderIcon,
  PackagePlusIcon,
  RefreshCwIcon,
  SearchIcon,
  TagIcon,
  TableIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"
import * as XLSX from "xlsx"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/products`
const PAGE_LIMIT = 20
const UNMAPPED_COLUMN = "__unmapped__"

function getInitialListSearch(): string {
  return new URLSearchParams(window.location.search).get("search") ?? ""
}

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
  addedtime: string
  addeduser: string
}

type ImportMode = "skip" | "update"
type ImportField = keyof ProductFormState
type ImportMapping = Record<ImportField, string>

type ParsedImportFile = {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
}

type ImportSummary = {
  created: number
  updated: number
  skipped: number
  failed: number
  total: number
}

type ImportResult = {
  summary: ImportSummary
  errors: Array<{ row: number; error: string }>
  skipped: Array<{ row: number; productcode: string; reason: string }>
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

const importFields: Array<{
  key: ImportField
  label: string
  required?: boolean
  aliases: string[]
}> = [
  { key: "productdescription", label: "Product description", required: true, aliases: ["productdescription", "product description", "description", "product", "item description", "name"] },
  { key: "productcode", label: "Product code", required: true, aliases: ["productcode", "product code", "code", "sku", "item code", "part number"] },
  { key: "brand", label: "Brand", required: true, aliases: ["brand", "make", "manufacturer"] },
  { key: "unitprice", label: "Unit price", aliases: ["unitprice", "unit price", "price", "rate", "mrp", "selling price"] },
  { key: "gstrate", label: "GST rate", aliases: ["gstrate", "gst rate", "gst", "tax", "tax rate"] },
  { key: "hsncode", label: "HSN code", aliases: ["hsncode", "hsn code", "hsn"] },
  { key: "productlink", label: "Product link", aliases: ["productlink", "product link", "link", "url"] },
  { key: "maxdiscount", label: "Max discount", aliases: ["maxdiscount", "max discount", "discount"] },
  { key: "maxupsell", label: "Max upsell", aliases: ["maxupsell", "max upsell", "upsell", "margin"] },
  { key: "calibrationcharges", label: "Calibration charges", aliases: ["calibrationcharges", "calibration charges", "calibration"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom", "measure"] },
  { key: "addedtime", label: "Added date", aliases: ["addedtime", "added time", "added date", "date"] },
  { key: "addeduser", label: "Added user", aliases: ["addeduser", "added user", "user", "created by"] },
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

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function createEmptyMapping(): ImportMapping {
  return Object.fromEntries(importFields.map((field) => [field.key, UNMAPPED_COLUMN])) as ImportMapping
}

function suggestMapping(headers: string[]): ImportMapping {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header),
  }))

  return Object.fromEntries(
    importFields.map((field) => {
      const match = normalizedHeaders.find(({ normalized }) =>
        field.aliases.some((alias) => normalized === normalizeHeader(alias))
      )
      return [field.key, match?.header ?? UNMAPPED_COLUMN]
    })
  ) as ImportMapping
}

async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("The file does not contain a worksheet")

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  })

  const headerRow = rawRows.find((row) => row.some((cell) => stringifyCell(cell)))
  if (!headerRow) throw new Error("The file does not contain a header row")

  const headers = headerRow.map((cell, index) => stringifyCell(cell) || `Column ${index + 1}`)
  const rows = rawRows
    .slice(rawRows.indexOf(headerRow) + 1)
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, stringifyCell(row[index])]))
    )
    .filter((row) => Object.values(row).some(Boolean))

  if (rows.length === 0) throw new Error("The file does not contain product rows")

  return { fileName: file.name, headers, rows }
}

function buildImportProducts(file: ParsedImportFile | null, mapping: ImportMapping) {
  if (!file) return []

  return file.rows.map((row) =>
    Object.fromEntries(
      importFields
        .filter((field) => mapping[field.key] !== UNMAPPED_COLUMN)
        .map((field) => [field.key, row[mapping[field.key]] ?? ""])
    )
  )
}

function getImportValidationErrors(file: ParsedImportFile | null, mapping: ImportMapping) {
  const errors: string[] = []
  if (!file) return ["Upload a CSV or Excel file to continue."]

  for (const field of importFields.filter((item) => item.required)) {
    if (mapping[field.key] === UNMAPPED_COLUMN) {
      errors.push(`${field.label} must be mapped.`)
    }
  }

  const mappedProducts = buildImportProducts(file, mapping)
  mappedProducts.forEach((product, index) => {
    for (const field of importFields.filter((item) => item.required)) {
      if (!String(product[field.key] ?? "").trim()) {
        errors.push(`Row ${index + 2} is missing ${field.label}.`)
      }
    }
  })

  return errors.slice(0, 12)
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
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <BoxIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {search ? "No products match that search" : "No products in the catalog yet"}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
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

function ProductImportPanel({
  parsedFile,
  mapping,
  mode,
  parsing,
  importing,
  parseError,
  importResult,
  validationErrors,
  onFileChange,
  onMappingChange,
  onModeChange,
  onImport,
  onReset,
}: {
  parsedFile: ParsedImportFile | null
  mapping: ImportMapping
  mode: ImportMode
  parsing: boolean
  importing: boolean
  parseError: string | null
  importResult: ImportResult | null
  validationErrors: string[]
  onFileChange: (file: File | null) => void
  onMappingChange: (field: ImportField, column: string) => void
  onModeChange: (mode: ImportMode) => void
  onImport: () => void
  onReset: () => void
}) {
  const previewRows = parsedFile?.rows.slice(0, 5) ?? []
  const canImport = Boolean(parsedFile) && validationErrors.length === 0 && !importing

  return (
    <div className="grid gap-5 px-5 pb-5">
      <div className="rounded-xl border border-dashed bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileSpreadsheetIcon className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Upload product spreadsheet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Supports CSV, XLS, and XLSX files. The first populated row is treated as headers.
              </p>
              {parsedFile && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{parsedFile.fileName}</span> ·{" "}
                  {parsedFile.rows.length.toLocaleString("en-IN")} rows · {parsedFile.headers.length} columns
                </p>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:shrink-0">
            {parsedFile && (
              <Button type="button" variant="outline" onClick={onReset} disabled={importing} className="w-full md:w-auto">
                Reset
              </Button>
            )}
            <Label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 md:w-auto">
              {parsing ? <LoaderIcon className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
              Choose file
              <Input
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={parsing || importing}
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </Label>
          </div>
        </div>
        {parseError && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {parseError}
          </div>
        )}
      </div>

      {parsedFile && (
        <>
          <div className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold">Column matching</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Match your spreadsheet columns to product fields before importing.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {importFields.map((field) => (
                <div key={field.key} className="grid gap-1.5 rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{field.label}</Label>
                    {field.required && <Badge variant="outline">Required</Badge>}
                  </div>
                  <Select value={mapping[field.key]} onValueChange={(value) => onMappingChange(field.key, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED_COLUMN}>Do not import</SelectItem>
                      {parsedFile.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
            <div>
              <h3 className="text-sm font-semibold">Duplicate product codes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose what happens when an uploaded product code already exists.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onModeChange("skip")}
                className={cn(
                  "rounded-lg border bg-background p-3 text-left text-sm transition-colors",
                  mode === "skip" && "border-primary bg-primary/5"
                )}
              >
                <span className="font-medium">Skip duplicates</span>
                <span className="mt-1 block text-muted-foreground">Keep existing products unchanged.</span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange("update")}
                className={cn(
                  "rounded-lg border bg-background p-3 text-left text-sm transition-colors",
                  mode === "update" && "border-primary bg-primary/5"
                )}
              >
                <span className="font-medium">Update existing</span>
                <span className="mt-1 block text-muted-foreground">Overwrite mapped fields for matching codes.</span>
              </button>
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <XCircleIcon className="size-4" />
                Fix these issues before importing
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2Icon className="size-4" />
                {parsedFile.rows.length.toLocaleString("en-IN")} rows ready to import
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">Preview</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {parsedFile.headers.slice(0, 8).map((header) => (
                      <th key={header} className="px-4 py-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      {parsedFile.headers.slice(0, 8).map((header) => (
                        <td key={header} className="max-w-48 truncate px-4 py-2.5">
                          {row[header] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importResult && (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm">
              <h3 className="font-semibold">Last import summary</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Badge variant="outline">Created {importResult.summary.created}</Badge>
                <Badge variant="outline">Updated {importResult.summary.updated}</Badge>
                <Badge variant="outline">Skipped {importResult.summary.skipped}</Badge>
                <Badge variant={importResult.summary.failed ? "destructive" : "outline"}>
                  Failed {importResult.summary.failed}
                </Badge>
              </div>
            </div>
          )}

          <Button type="button" onClick={onImport} disabled={!canImport}>
            {importing && <LoaderIcon className="size-4 animate-spin" />}
            Import products
          </Button>
        </>
      )}
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
}: {
  stats: ProductStats | null
  statsLoading: boolean
  recentProducts: Product[]
  recentLoading: boolean
  onViewCatalog: () => void
  onAddProduct: () => void
  onBulkImport: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Products</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your product catalog, add new items, and track inventory stats.
          </p>
        </div>
      </div>

      <div className="space-y-6 p-6 animate-in fade-in-0 duration-300">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Products"
            value={stats?.totalProducts.toLocaleString("en-IN") ?? "0"}
            icon={BoxIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Unique Brands"
            value={stats?.uniqueBrands.toLocaleString("en-IN") ?? "0"}
            icon={TagIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Avg. Unit Price"
            value={
              stats?.avgUnitPrice
                ? new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(stats.avgUnitPrice)
                : "—"
            }
            icon={IndianRupeeIcon}
            loading={statsLoading}
          />
          <StatCard
            label="Added This Month"
            value={stats?.recentlyAdded.toLocaleString("en-IN") ?? "0"}
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
              <h3 className="text-sm font-semibold">Add Product</h3>
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
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 font-medium">
                        {product.productdescription || "Untitled product"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {product.brand || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {toCurrency(product.unitprice)}
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
  const [importSheetOpen, setImportSheetOpen] = useState(false)
  const [parsedImportFile, setParsedImportFile] = useState<ParsedImportFile | null>(null)
  const [importMapping, setImportMapping] = useState<ImportMapping>(() => createEmptyMapping())
  const [importMode, setImportMode] = useState<ImportMode>("skip")
  const [parsingImport, setParsingImport] = useState(false)
  const [importingProducts, setImportingProducts] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

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

  const importValidationErrors = useMemo(
    () => getImportValidationErrors(parsedImportFile, importMapping),
    [parsedImportFile, importMapping]
  )

  function openCreateSheet() {
    setEditingProduct(null)
    setForm({ ...emptyForm, addedtime: new Date().toISOString().slice(0, 10) })
    setSaveError(null)
    setSheetOpen(true)
  }

  function openImportSheet() {
    setImportSheetOpen(true)
    setImportError(null)
  }

  function resetImport() {
    setParsedImportFile(null)
    setImportMapping(createEmptyMapping())
    setImportError(null)
    setImportResult(null)
  }

  async function handleImportFile(file: File | null) {
    if (!file) return

    setParsingImport(true)
    setImportError(null)
    setImportResult(null)
    try {
      const parsed = await parseImportFile(file)
      setParsedImportFile(parsed)
      setImportMapping(suggestMapping(parsed.headers))
    } catch (err) {
      setParsedImportFile(null)
      setImportMapping(createEmptyMapping())
      setImportError(err instanceof Error ? err.message : "Unable to parse import file")
    } finally {
      setParsingImport(false)
    }
  }

  async function importProducts() {
    if (!parsedImportFile || importValidationErrors.length > 0) return

    setImportingProducts(true)
    setImportError(null)
    try {
      const response = await fetch(`${API_BASE}/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMode,
          products: buildImportProducts(parsedImportFile, importMapping),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to import products")
      }

      const result = payload as ImportResult
      setImportResult(result)
      toast.success(
        `Import complete: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.skipped} skipped`
      )
      if (view === "table") {
        await fetchProducts()
      }
      void fetchStats()
      void fetchRecentProducts()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unable to import products")
    } finally {
      setImportingProducts(false)
    }
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      })

      const payload = await response.json().catch(() => null)
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
              onBulkImport={openImportSheet}
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
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
                  <BoxIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Products</h2>
                  {!loading && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                      {total.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                      <Button variant="outline" size="sm" onClick={openImportSheet}>
                        <UploadIcon className="size-4" />
                        Bulk upload
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import products from CSV or Excel</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={openCreateSheet}>
                        <PackagePlusIcon className="size-4" />
                        Add Product
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add a new catalog product</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center gap-4 border-b px-4 py-3">
                <div className="relative max-w-xl flex-1">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search brand, product code, HSN, description..."
                    className="pl-10"
                  />
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{visibleRange}</span> of{" "}
                  <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span>
                </span>
              </div>

              {error ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <AlertCircleIcon className="size-5 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => void fetchProducts()}>
                    Try again
                  </Button>
                </div>
              ) : loading ? (
                <ProductTableSkeleton />
              ) : products.length === 0 ? (
                <EmptyState search={debouncedSearch} />
              ) : (
                <div className="flex-1 overflow-auto animate-in fade-in-0 duration-300">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-2.5">Code</th>
                        <th className="px-5 py-2.5">Product</th>
                        <th className="px-5 py-2.5">Brand</th>
                        <th className="px-5 py-2.5">Price</th>
                        <th className="px-5 py-2.5">GST</th>
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
                          <td className="px-5 py-3.5 align-top font-semibold">{toCurrency(product.unitprice)}</td>
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

      <Sheet open={importSheetOpen} onOpenChange={setImportSheetOpen}>
        <SheetContent className="w-[min(100vw,56rem)] max-w-none overflow-y-auto sm:max-w-none" side="right">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl">Bulk upload products</SheetTitle>
            <SheetDescription>
              Upload a CSV or Excel file, match columns to product fields, then import catalog rows.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ProductImportPanel
            parsedFile={parsedImportFile}
            mapping={importMapping}
            mode={importMode}
            parsing={parsingImport}
            importing={importingProducts}
            parseError={importError}
            importResult={importResult}
            validationErrors={importValidationErrors}
            onFileChange={(file) => void handleImportFile(file)}
            onMappingChange={(field, column) =>
              setImportMapping((current) => ({ ...current, [field]: column }))
            }
            onModeChange={setImportMode}
            onImport={() => void importProducts()}
            onReset={resetImport}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
