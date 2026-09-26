import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  procurementSettingsQueryOptions,
  saveProcurementSettings,
  type ProcurementSettings,
} from "@/lib/queries/procurement"

const TEXTAREA_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"

interface FormState {
  instructions: string
  preferredStates: string
  excludedKeywords: string
  requireGstRegistered: boolean
  requireVerifiedSupplier: boolean
  defaultMarginPercent: string
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function SourcingPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: settings, isPending, error } = useQuery({ ...procurementSettingsQueryOptions, enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sourcing Preferences</DialogTitle>
          <DialogDescription>
            These rules apply to every supplier search in your organization.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : isPending || !settings ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <PreferencesForm settings={settings} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PreferencesForm({ settings, onClose }: { settings: ProcurementSettings; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => ({
    instructions: settings.instructions,
    preferredStates: settings.preferredStates.join(", "),
    excludedKeywords: settings.excludedKeywords.join(", "),
    requireGstRegistered: settings.requireGstRegistered,
    requireVerifiedSupplier: settings.requireVerifiedSupplier,
    defaultMarginPercent: String(settings.defaultMarginPercent),
  }))
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleSave = async () => {
    const margin = Number(form.defaultMarginPercent)
    if (!Number.isFinite(margin) || margin < 0 || margin > 500) {
      toast.error("Default margin must be between 0 and 500 percent")
      return
    }
    setSaving(true)
    try {
      await saveProcurementSettings({
        instructions: form.instructions,
        preferredStates: splitList(form.preferredStates),
        excludedKeywords: splitList(form.excludedKeywords),
        requireGstRegistered: form.requireGstRegistered,
        requireVerifiedSupplier: form.requireVerifiedSupplier,
        defaultMarginPercent: margin,
      })
      toast.success("Sourcing preferences saved")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save sourcing preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="procurementInstructions">Sourcing guidance</Label>
          <textarea
            id="procurementInstructions"
            rows={4}
            maxLength={4000}
            value={form.instructions}
            onChange={(event) => update("instructions", event.target.value)}
            placeholder="We resell industrial measuring instruments and hand tools. We don't source chemicals or custom-fabricated parts."
            className={TEXTAREA_CLASS}
          />
          <p className="text-[11px] text-muted-foreground">
            The agent uses this to decide whether an item is worth searching for.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="procurementStates">Preferred supplier states</Label>
          <Input
            id="procurementStates"
            value={form.preferredStates}
            onChange={(event) => update("preferredStates", event.target.value)}
            placeholder="Tamil Nadu, Karnataka"
          />
          <p className="text-[11px] text-muted-foreground">Comma-separated. Suppliers here rank higher.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="procurementExcluded">Never source</Label>
          <Input
            id="procurementExcluded"
            value={form.excludedKeywords}
            onChange={(event) => update("excludedKeywords", event.target.value)}
            placeholder="chemicals, refurbished"
          />
          <p className="text-[11px] text-muted-foreground">
            Comma-separated. Requests containing these terms are skipped without searching.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
          <div>
            <Label htmlFor="procurementGst">Require a GST number</Label>
            <p className="text-[11px] text-muted-foreground">Hide suppliers that don't list a GSTIN.</p>
          </div>
          <Switch
            id="procurementGst"
            checked={form.requireGstRegistered}
            onCheckedChange={(checked) => update("requireGstRegistered", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
          <div>
            <Label htmlFor="procurementVerified">Only verified suppliers</Label>
            <p className="text-[11px] text-muted-foreground">Hide suppliers the directory hasn't verified.</p>
          </div>
          <Switch
            id="procurementVerified"
            checked={form.requireVerifiedSupplier}
            onCheckedChange={(checked) => update("requireVerifiedSupplier", checked)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="procurementMargin">Default margin (%)</Label>
          <Input
            id="procurementMargin"
            type="number"
            min="0"
            max="500"
            value={form.defaultMarginPercent}
            onChange={(event) => update("defaultMarginPercent", event.target.value)}
            className="w-32"
          />
          <p className="text-[11px] text-muted-foreground">
            Added to the supplier's cost when you use them on a quote.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Save Preferences
        </Button>
      </DialogFooter>
    </>
  )
}
