import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Spinner } from "@/components/ui/spinner"
import { API_ORIGIN } from "@/lib/env"
import { formatMoney } from "@/lib/format"
import {
  selectProcurementCandidate,
  type ProcurementCandidate,
  type ProcurementRun,
} from "@/lib/queries/procurement"

export interface ProcuredQuoteLine {
  productId: string
  source: "catalog" | "custom"
  description: string
  brand: string
  code: string
  price: number
  hsnCode: string
  gstRate: string
}

interface FormState {
  description: string
  brand: string
  code: string
  hsnCode: string
  gstRate: string
  cost: string
  margin: string
}

interface UseSupplierFormProps {
  run: ProcurementRun
  candidate: ProcurementCandidate
  defaultMarginPercent: number
  canSaveToCatalog: boolean
  onConfirm: (line: ProcuredQuoteLine) => void
  onClose: () => void
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function createCatalogProduct(form: FormState, price: number): Promise<string> {
  const response = await fetch(`${API_ORIGIN}/api/v1/products`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productdescription: form.description.trim(),
      productcode: form.code.trim(),
      brand: form.brand.trim(),
      unitprice: price,
      hsncode: form.hsnCode.trim() || null,
      gstrate: parseNumber(form.gstRate),
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.id) throw new Error(data?.error || "Failed to add product to catalogue")
  return String(data.id)
}

export function UseSupplierDialog({
  open,
  onOpenChange,
  candidate,
  ...formProps
}: Omit<UseSupplierFormProps, "candidate" | "onClose"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: ProcurementCandidate | null
}) {
  return (
    <Dialog open={open && candidate != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Use This Supplier</DialogTitle>
          <DialogDescription>
            Adds this item to the quote for “{formProps.run.requirement.name}”. Your selling price is the supplier's
            cost plus your margin.
          </DialogDescription>
        </DialogHeader>
        {candidate && <UseSupplierForm {...formProps} candidate={candidate} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function UseSupplierForm({ run, candidate, defaultMarginPercent, canSaveToCatalog, onConfirm, onClose }: UseSupplierFormProps) {
  const { listing } = candidate
  const [form, setForm] = useState<FormState>(() => ({
    description: listing.title,
    brand: listing.brand ?? run.requirement.manufacturer ?? "",
    code: listing.modelNumber ?? run.requirement.code ?? "",
    hsnCode: "",
    gstRate: "",
    cost: candidate.unitPrice != null ? String(candidate.unitPrice) : "",
    margin: String(defaultMarginPercent),
  }))
  const [saveToCatalog, setSaveToCatalog] = useState(canSaveToCatalog)
  const [submitting, setSubmitting] = useState(false)

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const cost = parseNumber(form.cost)
  const margin = parseNumber(form.margin) ?? 0
  const sellPrice = cost != null && cost >= 0 ? Math.round(cost * (1 + margin / 100) * 100) / 100 : null
  const catalogReady = Boolean(form.description.trim() && form.brand.trim() && form.code.trim())
  const canSubmit = sellPrice != null && (form.description.trim() !== "" || form.code.trim() !== "")

  const handleConfirm = async () => {
    if (!canSubmit || sellPrice == null) return
    setSubmitting(true)
    try {
      const productId =
        canSaveToCatalog && saveToCatalog && catalogReady ? await createCatalogProduct(form, sellPrice) : null
      // Recording the choice is bookkeeping; the quote line matters more than a failed history write.
      await selectProcurementCandidate(run, candidate.id).catch((err) =>
        console.error("Failed to record selected supplier:", err)
      )
      onConfirm({
        productId: productId ?? "0",
        source: productId ? "catalog" : "custom",
        description: form.description.trim(),
        brand: form.brand.trim(),
        code: form.code.trim(),
        price: sellPrice,
        hsnCode: form.hsnCode.trim(),
        gstRate: form.gstRate.trim(),
      })
      toast.success(productId ? "Supplier item added to the quote and catalogue" : "Supplier item added to the quote")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add supplier item")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
        <p className="font-medium">{listing.supplier.name}</p>
        <p className="text-muted-foreground">
          {listing.supplier.city}, {listing.supplier.state}
          {listing.price != null && listing.priceUnit
            ? ` · Listed at ${formatMoney(listing.price)} per ${listing.priceUnit}`
            : " · Price on request"}
        </p>
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="procuredDescription">Description</Label>
          <Input
            id="procuredDescription"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="procuredBrand">Brand</Label>
            <Input id="procuredBrand" value={form.brand} onChange={(event) => update("brand", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="procuredCode">Code</Label>
            <Input id="procuredCode" value={form.code} onChange={(event) => update("code", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="procuredHsn">HSN code</Label>
            <Input id="procuredHsn" value={form.hsnCode} onChange={(event) => update("hsnCode", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="procuredGst">GST (%)</Label>
            <Input
              id="procuredGst"
              type="number"
              min="0"
              value={form.gstRate}
              onChange={(event) => update("gstRate", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="procuredCost">Supplier cost per unit (₹)</Label>
            <Input
              id="procuredCost"
              type="number"
              min="0"
              value={form.cost}
              onChange={(event) => update("cost", event.target.value)}
              placeholder={candidate.unitPrice == null ? "Ask the supplier" : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="procuredMargin">Margin (%)</Label>
            <Input
              id="procuredMargin"
              type="number"
              min="0"
              value={form.margin}
              onChange={(event) => update("margin", event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Selling price per unit</span>
          <span className="text-sm font-semibold tabular-nums">
            {sellPrice != null ? formatMoney(sellPrice) : "Enter the supplier's cost"}
          </span>
        </div>

        {canSaveToCatalog && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="procuredSaveToCatalog"
                checked={saveToCatalog && catalogReady}
                disabled={!catalogReady}
                onCheckedChange={(checked) => setSaveToCatalog(checked === true)}
              />
              <Label htmlFor="procuredSaveToCatalog" className="text-xs font-normal">
                Also save to the product catalogue so future RFQs match it
              </Label>
            </div>
            {!catalogReady && (
              <p className="pl-6 text-[11px] text-muted-foreground">
                Description, brand, and code are required to save to catalogue.
              </p>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!canSubmit || submitting}>
          {submitting && <Spinner data-icon="inline-start" />}
          Add to Quote
        </Button>
      </DialogFooter>
    </>
  )
}
