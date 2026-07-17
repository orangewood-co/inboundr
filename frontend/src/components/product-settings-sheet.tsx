import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

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
import { Switch } from "@/components/ui/switch"
import type { ProductSettings } from "@/lib/catalog"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ProductSettings | null
  endpoint: string
  onSaved: (settings: ProductSettings) => void
}

function cloneSettings(settings: ProductSettings): ProductSettings {
  return JSON.parse(JSON.stringify(settings)) as ProductSettings
}

export function ProductSettingsSheet({
  open,
  onOpenChange,
  settings,
  endpoint,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<ProductSettings | null>(settings ? cloneSettings(settings) : null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Unable to save catalog settings")
      onSaved(payload as ProductSettings)
      onOpenChange(false)
      toast.success("Catalog settings saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save catalog settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Catalog Settings</SheetTitle>
          <SheetDescription>
            Choose catalog terminology, custom metadata, quote adjustments, and search guidance.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        {draft && (
          <div className="space-y-7 px-5 pb-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Terminology</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["singular", "Singular name"],
                  ["plural", "Plural name"],
                  ["skuLabel", "SKU/code label"],
                  ["manufacturerLabel", "Manufacturer label"],
                  ["taxCodeLabel", "Tax code label"],
                  ["taxRateLabel", "Tax rate label"],
                ] as const).map(([key, label]) => (
                  <div className="grid gap-2" key={key}>
                    <Label>{label}</Label>
                    <Input
                      value={draft.terminology[key]}
                      onChange={(event) => setDraft({
                        ...draft,
                        terminology: { ...draft.terminology, [key]: event.target.value },
                      })}
                    />
                  </div>
                ))}
              </div>
            </section>

            <Separator />
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Custom Product Fields</h3>
                  <p className="text-xs text-muted-foreground">Typed metadata can be imported and optionally included in matching.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft({
                    ...draft,
                    fieldDefinitions: [...draft.fieldDefinitions, {
                      id: crypto.randomUUID(),
                      key: "",
                      label: "New field",
                      type: "text",
                      options: [],
                      required: false,
                      isActive: true,
                      showInList: false,
                      searchable: false,
                      importAliases: [],
                      order: (draft.fieldDefinitions.length + 1) * 10,
                    }],
                  })}
                >
                  <PlusIcon className="size-4" /> Add field
                </Button>
              </div>
              {draft.fieldDefinitions.map((field, index) => (
                <div key={field.id} className="space-y-3 rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
                    <Input
                      value={field.label}
                      placeholder="Label"
                      onChange={(event) => setDraft({
                        ...draft,
                        fieldDefinitions: draft.fieldDefinitions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item
                        ),
                      })}
                    />
                    <Input
                      value={field.key}
                      placeholder="field_key"
                      onChange={(event) => setDraft({
                        ...draft,
                        fieldDefinitions: draft.fieldDefinitions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, key: event.target.value } : item
                        ),
                      })}
                    />
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={field.type}
                      onChange={(event) => setDraft({
                        ...draft,
                        fieldDefinitions: draft.fieldDefinitions.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, type: event.target.value as typeof item.type }
                            : item
                        ),
                      })}
                    >
                      {["text", "number", "date", "boolean", "select"].map((type) => (
                        <option value={type} key={type}>{type}</option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDraft({
                        ...draft,
                        fieldDefinitions: draft.fieldDefinitions.filter((_, itemIndex) => itemIndex !== index),
                      })}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  {field.type === "select" && (
                    <Input
                      value={field.options.join(", ")}
                      placeholder="Options separated by commas"
                      onChange={(event) => setDraft({
                        ...draft,
                        fieldDefinitions: draft.fieldDefinitions.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }
                            : item
                        ),
                      })}
                    />
                  )}
                  <div className="flex flex-wrap gap-5 text-xs">
                    {([
                      ["required", "Required"],
                      ["searchable", "Searchable"],
                      ["showInList", "Show in list"],
                    ] as const).map(([key, label]) => (
                      <Label className="flex items-center gap-2" key={key}>
                        <Switch
                          checked={field[key]}
                          onCheckedChange={(checked) => setDraft({
                            ...draft,
                            fieldDefinitions: draft.fieldDefinitions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, [key]: checked } : item
                            ),
                          })}
                        />
                        {label}
                      </Label>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <Separator />
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Default Quote Adjustments</h3>
                  <p className="text-xs text-muted-foreground">Examples include calibration, installation, freight, or packaging.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft({
                    ...draft,
                    adjustmentDefinitions: [...draft.adjustmentDefinitions, {
                      id: crypto.randomUUID(),
                      code: "",
                      label: "New adjustment",
                      type: "fixed",
                      defaultValue: 0,
                      taxable: false,
                      isActive: true,
                    }],
                  })}
                >
                  <PlusIcon className="size-4" /> Add adjustment
                </Button>
              </div>
              {draft.adjustmentDefinitions.map((adjustment, index) => (
                <div key={adjustment.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_9rem_8rem_auto]">
                  <Input
                    value={adjustment.label}
                    placeholder="Label"
                    onChange={(event) => setDraft({
                      ...draft,
                      adjustmentDefinitions: draft.adjustmentDefinitions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item
                      ),
                    })}
                  />
                  <Input
                    value={adjustment.code}
                    placeholder="code"
                    onChange={(event) => setDraft({
                      ...draft,
                      adjustmentDefinitions: draft.adjustmentDefinitions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, code: event.target.value } : item
                      ),
                    })}
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={adjustment.type}
                    onChange={(event) => setDraft({
                      ...draft,
                      adjustmentDefinitions: draft.adjustmentDefinitions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, type: event.target.value as "fixed" | "percentage" } : item
                      ),
                    })}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percent</option>
                  </select>
                  <Input
                    type="number"
                    min="0"
                    value={adjustment.defaultValue}
                    onChange={(event) => setDraft({
                      ...draft,
                      adjustmentDefinitions: draft.adjustmentDefinitions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, defaultValue: Number(event.target.value) } : item
                      ),
                    })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft({
                      ...draft,
                      adjustmentDefinitions: draft.adjustmentDefinitions.filter((_, itemIndex) => itemIndex !== index),
                    })}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </section>

            <Separator />
            <section className="space-y-2">
              <Label>Search guidance</Label>
              <textarea
                className="min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={draft.search.instructions}
                onChange={(event) => setDraft({
                  ...draft,
                  search: { ...draft.search, instructions: event.target.value },
                })}
                placeholder="Describe organization-specific vocabulary, code formats, units, and matching rules."
              />
            </section>
          </div>
        )}
        <SheetFooter className="flex-row justify-end border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!draft || saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
