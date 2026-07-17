import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { API_ORIGIN } from "@/lib/env"
import type { ProductSettings } from "@/lib/catalog"

const SETTINGS_ENDPOINT = `${API_ORIGIN}/api/v1/products/settings`

export default function ProductsSettingsPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ProductSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(SETTINGS_ENDPOINT, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load catalog settings")
        return (await response.json()) as ProductSettings
      })
      .then((settings) => {
        if (!cancelled) setDraft(settings)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load catalog settings")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const response = await fetch(SETTINGS_ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Unable to save catalog settings")
      setDraft(payload as ProductSettings)
      toast.success("Catalog settings saved")
      void navigate({ to: "/products" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save catalog settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "Catalog Settings" },
        ]}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
          <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
                <Link to="/products">
                  <ArrowLeftIcon className="size-4" />
                  Back to Products
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">Catalog Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose catalog terminology, custom metadata, quote adjustments, and search guidance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" disabled={saving}>
                <Link to="/products">Cancel</Link>
              </Button>
              <Button onClick={() => void save()} disabled={!draft || saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Save Settings
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-16" />
                ))}
              </div>
              <Skeleton className="h-40" />
            </div>
          ) : loadError || !draft ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {loadError ?? "Unable to load catalog settings"}
            </div>
          ) : (
            <div className="space-y-8 pb-10">
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Terminology</h2>
                  <p className="text-sm text-muted-foreground">
                    Rename how catalog concepts appear across the app.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Custom Product Fields</h2>
                    <p className="text-sm text-muted-foreground">
                      Typed metadata can be imported and optionally included in matching.
                    </p>
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
                    <PlusIcon className="size-4" /> Add Field
                  </Button>
                </div>
                {draft.fieldDefinitions.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No custom fields yet. Add one to capture extra product metadata.
                  </p>
                )}
                {draft.fieldDefinitions.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Label</Label>
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
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Field key</Label>
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
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Type</Label>
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
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDraft({
                            ...draft,
                            fieldDefinitions: draft.fieldDefinitions.filter((_, itemIndex) => itemIndex !== index),
                          })}
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Remove field</span>
                        </Button>
                      </div>
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
                    <div className="flex flex-wrap gap-6 text-xs">
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Default Quote Adjustments</h2>
                    <p className="text-sm text-muted-foreground">
                      Examples include calibration, installation, freight, or packaging.
                    </p>
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
                    <PlusIcon className="size-4" /> Add Adjustment
                  </Button>
                </div>
                {draft.adjustmentDefinitions.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No adjustments yet. Add one to pre-fill charges on quotes.
                  </p>
                )}
                {draft.adjustmentDefinitions.map((adjustment, index) => (
                  <div key={adjustment.id} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_9rem_8rem_auto]">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Label</Label>
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
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Code</Label>
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
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Type</Label>
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
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Default value</Label>
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
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDraft({
                          ...draft,
                          adjustmentDefinitions: draft.adjustmentDefinitions.filter((_, itemIndex) => itemIndex !== index),
                        })}
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Remove adjustment</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </section>

              <Separator />

              <section className="space-y-2">
                <div>
                  <h2 className="text-base font-semibold">Search Guidance</h2>
                  <p className="text-sm text-muted-foreground">
                    Help the matching engine understand your catalog vocabulary.
                  </p>
                </div>
                <textarea
                  className="min-h-32 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
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
        </div>
      </main>
    </AppLayout>
  )
}
