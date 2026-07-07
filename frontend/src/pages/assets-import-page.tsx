import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  LoaderIcon,
  TableIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import { assetsFetch } from "@/lib/assets"

const UNMAPPED_COLUMN = "__unmapped__"

type ImportStep = "upload" | "mapping" | "review" | "complete"

type AssetImportField =
  | "name"
  | "assetCode"
  | "serialNumber"
  | "description"
  | "category"
  | "location"
  | "purchaseDate"
  | "purchaseCost"
  | "vendorName"
  | "invoiceReference"
  | "availableForUseDate"
  | "warrantyExpiryDate"
  | "amcExpiryDate"
  | "method"
  | "usefulLifeMonths"
  | "salvagePercentage"
  | "wdvRatePercentage"
  | "openingAccumulatedDepreciation"
  | "status"

type ImportMapping = Record<AssetImportField, string>

type ParsedImportFile = {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
}

type ImportResult = {
  summary: { created: number; skipped: number; failed: number; total: number }
  errors: Array<{ row: number; error: string }>
  skipped: Array<{ row: number; assetCode: string; reason: string }>
}

const importFields: Array<{
  key: AssetImportField
  label: string
  required?: boolean
  aliases: string[]
}> = [
  { key: "name", label: "Asset name", required: true, aliases: ["name", "asset name", "asset", "description of asset", "item"] },
  { key: "assetCode", label: "Asset code", aliases: ["assetcode", "asset code", "code", "asset id", "tag", "asset tag"] },
  { key: "serialNumber", label: "Serial number", aliases: ["serialnumber", "serial number", "serial", "sn", "serial no"] },
  { key: "description", label: "Description", aliases: ["description", "details", "notes"] },
  { key: "category", label: "Category (by name)", aliases: ["category", "asset category", "type", "asset type"] },
  { key: "location", label: "Location (by name)", aliases: ["location", "site", "office", "branch"] },
  { key: "purchaseDate", label: "Purchase date", aliases: ["purchasedate", "purchase date", "date of purchase", "bought on"] },
  { key: "purchaseCost", label: "Purchase cost", aliases: ["purchasecost", "purchase cost", "cost", "price", "amount", "value"] },
  { key: "vendorName", label: "Vendor", aliases: ["vendorname", "vendor", "supplier", "seller"] },
  { key: "invoiceReference", label: "Invoice reference", aliases: ["invoicereference", "invoice reference", "invoice", "invoice no", "bill no"] },
  { key: "availableForUseDate", label: "Available for use", aliases: ["availableforusedate", "available for use", "in use from", "commissioned"] },
  { key: "warrantyExpiryDate", label: "Warranty expiry", aliases: ["warrantyexpirydate", "warranty expiry", "warranty", "warranty end"] },
  { key: "amcExpiryDate", label: "AMC expiry", aliases: ["amcexpirydate", "amc expiry", "amc", "amc end"] },
  { key: "method", label: "Depreciation method", aliases: ["method", "depreciation method", "dep method"] },
  { key: "usefulLifeMonths", label: "Useful life (months)", aliases: ["usefullifemonths", "useful life months", "useful life", "life months", "life"] },
  { key: "salvagePercentage", label: "Salvage %", aliases: ["salvagepercentage", "salvage percentage", "salvage", "salvage %", "residual %"] },
  { key: "wdvRatePercentage", label: "WDV rate %", aliases: ["wdvratepercentage", "wdv rate", "wdv %", "depreciation rate"] },
  { key: "openingAccumulatedDepreciation", label: "Opening accumulated depreciation", aliases: ["openingaccumulateddepreciation", "opening accumulated depreciation", "accumulated depreciation", "opening depreciation"] },
  { key: "status", label: "Status (draft or active)", aliases: ["status", "state", "lifecycle"] },
]

const steps: Array<{ id: ImportStep; label: string; description: string }> = [
  { id: "upload", label: "Upload File", description: "Choose CSV or Excel" },
  { id: "mapping", label: "Match Columns", description: "Map spreadsheet headers" },
  { id: "review", label: "Review", description: "Validate rows before import" },
  { id: "complete", label: "Import", description: "Create asset records" },
]

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
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }))

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
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, stringifyCell(row[index])])))
    .filter((row) => Object.values(row).some(Boolean))

  if (rows.length === 0) throw new Error("The file does not contain asset rows")
  return { fileName: file.name, headers, rows }
}

function buildImportAssets(file: ParsedImportFile | null, mapping: ImportMapping) {
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

  buildImportAssets(file, mapping).forEach((asset, index) => {
    for (const field of importFields.filter((item) => item.required)) {
      if (!String(asset[field.key] ?? "").trim()) {
        errors.push(`Row ${index + 2} is missing ${field.label}.`)
      }
    }
  })

  return errors.slice(0, 20)
}

function Stepper({ currentStep }: { currentStep: ImportStep }) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-4">
      <div className="grid gap-4 md:grid-cols-4 md:gap-3">
        {steps.map((step, index) => {
          const active = step.id === currentStep
          const complete = index < currentIndex
          return (
            <div key={step.id} className="min-w-0">
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold text-muted-foreground shadow-xs transition-colors",
                    active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                    complete && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {complete ? <CheckCircle2Icon className="size-4" /> : index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span className={cn("ml-3 hidden h-px flex-1 bg-border md:block", complete && "bg-primary/60")} />
                )}
              </div>
              <div className="mt-3 pl-0.5">
                <p className={cn("text-sm font-semibold leading-none", active && "text-primary")}>
                  {step.label}
                </p>
                <p className="mt-2 text-xs leading-none text-muted-foreground">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AssetsImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<ImportStep>("upload")
  const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null)
  const [mapping, setMapping] = useState<ImportMapping>(() => createEmptyMapping())
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const validationErrors = useMemo(() => getImportValidationErrors(parsedFile, mapping), [parsedFile, mapping])
  const previewRows = parsedFile?.rows.slice(0, 8) ?? []
  const mappedCount = importFields.filter((field) => mapping[field.key] !== UNMAPPED_COLUMN).length

  async function handleFile(file: File | null) {
    if (!file) return

    setParsing(true)
    setError(null)
    setResult(null)
    try {
      const parsed = await parseImportFile(file)
      setParsedFile(parsed)
      setMapping(suggestMapping(parsed.headers))
      setStep("mapping")
    } catch (err) {
      setParsedFile(null)
      setMapping(createEmptyMapping())
      setError(err instanceof Error ? err.message : "Unable to parse import file")
      setStep("upload")
    } finally {
      setParsing(false)
    }
  }

  function resetFile() {
    setParsedFile(null)
    setMapping(createEmptyMapping())
    setError(null)
    setResult(null)
    setStep("upload")
  }

  async function submitImport() {
    if (!parsedFile || validationErrors.length > 0) return

    setImporting(true)
    setError(null)
    try {
      const payload = await assetsFetch<ImportResult>("/import", {
        method: "POST",
        body: JSON.stringify({ assets: buildImportAssets(parsedFile, mapping) }),
      })
      setResult(payload)
      setStep("complete")
      toast.success("Asset import completed")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import assets")
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Assets", href: "/assets" }, { label: "Import" }]} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
                <Link to="/assets">
                  <ArrowLeftIcon className="size-4" />
                  Back to Assets
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">Import Assets</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload an asset register spreadsheet, match columns, review validation, and import. Categories and locations are matched by name, so create them first in setup.
              </p>
            </div>
            <Button variant="outline" onClick={resetFile} disabled={!parsedFile || importing}>
              Start Over
            </Button>
          </div>

          <Stepper currentStep={step} />

          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircleIcon className="size-4" />
                {error}
              </div>
            </div>
          )}

          {step === "upload" && (
            <section className="rounded-2xl border bg-card p-8">
              <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-center">
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <FileSpreadsheetIcon className="size-6 text-primary" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold">Upload Your Asset Register</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Use CSV, XLS, or XLSX files. The first populated row is treated as the header row. Rows with a status of "active" are activated after import so their depreciation schedules generate immediately; other rows stay as drafts.
                  </p>
                </div>
                <Label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
                  {parsing ? <LoaderIcon className="size-8 animate-spin text-primary" /> : <UploadIcon className="size-8 text-primary" />}
                  <span className="mt-4 text-sm font-semibold">Choose CSV or Excel file</span>
                  <span className="mt-1 text-xs text-muted-foreground">CSV, XLS, XLSX supported</span>
                  <Input
                    type="file"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    disabled={parsing}
                    onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                  />
                </Label>
              </div>
            </section>
          )}

          {parsedFile && step === "mapping" && (
            <section className="space-y-5 rounded-2xl border bg-card p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Match Spreadsheet Columns</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Imported file: <span className="font-medium text-foreground">{parsedFile.fileName}</span> · {formatNumber(parsedFile.rows.length)} rows · {parsedFile.headers.length} columns.
                  </p>
                </div>
                <Badge variant="outline">{mappedCount} fields mapped</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {importFields.map((field) => (
                  <div key={field.key} className="grid gap-2 rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{field.label}</Label>
                      {field.required && <Badge variant="outline">Required</Badge>}
                    </div>
                    <Select value={mapping[field.key]} onValueChange={(value) => setMapping((current) => ({ ...current, [field.key]: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED_COLUMN}>Do Not Import</SelectItem>
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

              <div className="flex items-center justify-between border-t pt-5">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={() => setStep("review")}>Review Import</Button>
              </div>
            </section>
          )}

          {parsedFile && step === "review" && (
            <section className="space-y-5 rounded-2xl border bg-card p-6">
              <div>
                <h2 className="text-xl font-semibold">Review Before Import</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rows with an existing asset code are skipped. Check validation results before importing.
                </p>
              </div>

              {validationErrors.length > 0 ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <XCircleIcon className="size-4" />
                    Fix these issues before importing
                  </div>
                  <ul className="list-disc space-y-1 pl-5">
                    {validationErrors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2Icon className="size-4" />
                    {formatNumber(parsedFile.rows.length)} rows are ready to import.
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border">
                <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
                  <TableIcon className="size-4" />
                  Preview
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {parsedFile.headers.slice(0, 10).map((header) => (
                          <th key={header} className="px-4 py-2">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={index} className="border-b last:border-0">
                          {parsedFile.headers.slice(0, 10).map((header) => (
                            <td key={header} className="max-w-56 truncate px-4 py-2.5">
                              {row[header] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-5">
                <Button variant="outline" onClick={() => setStep("mapping")} disabled={importing}>
                  Back
                </Button>
                <Button onClick={() => void submitImport()} disabled={validationErrors.length > 0 || importing}>
                  {importing && <Spinner data-icon="inline-start" />}
                  Import Assets
                </Button>
              </div>
            </section>
          )}

          {step === "complete" && result && (
            <section className="space-y-5 rounded-2xl border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <CheckCircle2Icon className="size-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Import Complete</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Processed {formatNumber(result.summary.total)} rows from the uploaded file.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Created</p>
                  <p className="mt-1 text-2xl font-bold">{result.summary.created}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Skipped</p>
                  <p className="mt-1 text-2xl font-bold">{result.summary.skipped}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Failed</p>
                  <p className="mt-1 text-2xl font-bold">{result.summary.failed}</p>
                </div>
              </div>

              {(result.errors.length > 0 || result.skipped.length > 0) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {result.errors.length > 0 && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      <h3 className="font-semibold">Failed Rows</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {result.errors.slice(0, 10).map((item) => (
                          <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.skipped.length > 0 && (
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                      <h3 className="font-semibold">Skipped Duplicates</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        {result.skipped.slice(0, 10).map((item) => (
                          <li key={`${item.row}-${item.assetCode}`}>Row {item.row}: {item.assetCode}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetFile}>
                  Import Another File
                </Button>
                <Button onClick={() => void navigate({ to: "/assets" })}>
                  Back to Assets
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppLayout>
  )
}
