import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

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
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  CUSTOMER_SETTINGS_API,
  fetchCustomerSettings,
  sortCustomerFields,
  type CustomerFieldDefinition,
  type CustomerFieldType,
} from "@/lib/customer-fields"

const FIELD_TYPES: Array<{ value: CustomerFieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Single select" },
]

function createField(order: number): CustomerFieldDefinition {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    type: "text",
    options: [],
    isActive: true,
    isSystem: false,
    showInList: false,
    order,
  }
}

export function CustomerFieldSettings() {
  const [fields, setFields] = useState<CustomerFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetchCustomerSettings(controller.signal)
      .then(setFields)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load customer fields"))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const activeFields = useMemo(
    () => sortCustomerFields(fields.filter((field) => field.isActive)),
    [fields],
  )
  const archivedFields = useMemo(
    () => sortCustomerFields(fields.filter((field) => !field.isActive)),
    [fields],
  )

  function updateField(id: string, patch: Partial<CustomerFieldDefinition>) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    )
  }

  function moveField(id: string, direction: -1 | 1) {
    const ordered = [...activeFields]
    const index = ordered.findIndex((field) => field.id === id)
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= ordered.length) return
    ;[ordered[index], ordered[destination]] = [ordered[destination], ordered[index]]
    const orderById = new Map(ordered.map((field, itemIndex) => [field.id, (itemIndex + 1) * 10]))
    setFields((current) =>
      current.map((field) => ({
        ...field,
        order: orderById.get(field.id) ?? field.order,
      })),
    )
  }

  async function save() {
    const invalid = fields.find(
      (field) =>
        !field.label.trim() ||
        (field.type === "select" && field.options.filter((option) => option.trim()).length === 0),
    )
    if (invalid) {
      toast.error(
        invalid.type === "select"
          ? "Every select field needs at least one option"
          : "Every customer field needs a label",
      )
      return
    }

    setSaving(true)
    try {
      const response = await fetch(CUSTOMER_SETTINGS_API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldDefinitions: fields.map((field) => ({
            ...field,
            options: field.options.map((option) => option.trim()).filter(Boolean),
          })),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Unable to save customer fields")
      setFields(sortCustomerFields(data.fieldDefinitions ?? []))
      toast.success("Customer fields saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer fields")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border p-5 text-sm text-muted-foreground">
        <Spinner />
        Loading customer fields…
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Customer fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep the shared customer profile focused, then add the account details your organization
          actually uses.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b bg-muted/25 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Active fields</p>
            <p className="text-xs text-muted-foreground">
              Values remain stored when a field is archived.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setFields((current) => [
                ...current,
                createField(Math.max(0, ...current.map((field) => field.order)) + 10),
              ])
            }
          >
            <PlusIcon className="size-4" />
            Add field
          </Button>
        </div>

        <div className="divide-y">
          {activeFields.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No optional customer fields. Core contact fields remain available.
            </div>
          ) : (
            activeFields.map((field, index) => (
              <div key={field.id} className="grid gap-4 p-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <div className="grid gap-2">
                    <Label htmlFor={`field-label-${field.id}`}>Label</Label>
                    <Input
                      id={`field-label-${field.id}`}
                      value={field.label}
                      disabled={field.isSystem}
                      placeholder="e.g. Customer tier"
                      onChange={(event) => updateField(field.id, { label: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select
                      value={field.type}
                      disabled={field.isSystem}
                      onValueChange={(type: CustomerFieldType) =>
                        updateField(field.id, { type, options: type === "select" ? field.options : [] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => moveField(field.id, -1)}
                      aria-label={`Move ${field.label || "field"} up`}
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === activeFields.length - 1}
                      onClick={() => moveField(field.id, 1)}
                      aria-label={`Move ${field.label || "field"} down`}
                    >
                      <ArrowDownIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => updateField(field.id, { isActive: false })}
                      aria-label={`Archive ${field.label || "field"}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>

                {field.type === "select" && (
                  <div className="grid gap-2">
                    <Label htmlFor={`field-options-${field.id}`}>Options</Label>
                    <Input
                      id={`field-options-${field.id}`}
                      value={field.options.join(", ")}
                      placeholder="Prospect, Active, Strategic"
                      onChange={(event) =>
                        updateField(field.id, {
                          options: event.target.value.split(",").map((option) => option.trim()),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Separate options with commas.</p>
                  </div>
                )}

                <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">Show in customer list</span>
                    <span className="block text-xs text-muted-foreground">
                      Add this field as a column in the main table.
                    </span>
                  </span>
                  <Switch
                    checked={field.showInList}
                    onCheckedChange={(showInList) => updateField(field.id, { showInList })}
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </div>

      {archivedFields.length > 0 && (
        <div className="rounded-2xl border border-dashed p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Archived fields
          </p>
          <div className="space-y-2">
            {archivedFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs capitalize text-muted-foreground">{field.type.replace("_", " ")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => updateField(field.id, { isActive: true })}>
                  <RotateCcwIcon className="size-4" />
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon className="size-4" />}
          Save customer fields
        </Button>
      </div>
    </section>
  )
}
