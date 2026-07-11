import type {
  CustomerFieldDefinition,
  CustomerFieldValue,
} from "@/lib/customer-fields"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function CustomerFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomerFieldDefinition
  value: CustomerFieldValue | undefined
  onChange: (value: CustomerFieldValue) => void
}) {
  const inputId = `customer-field-${field.id}`

  if (field.type === "boolean") {
    return (
      <div className="flex min-h-10 items-center justify-between gap-4 rounded-lg border px-3 py-2">
        <Label htmlFor={inputId}>{field.label}</Label>
        <Switch
          id={inputId}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <div className="grid gap-2">
        <Label htmlFor={inputId}>{field.label}</Label>
        <Select
          value={typeof value === "string" && value ? value : undefined}
          onValueChange={onChange}
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{field.label}</Label>
      <Input
        id={inputId}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        min={field.id === "system.special_discount_percentage" ? 0 : undefined}
        max={field.id === "system.special_discount_percentage" ? 100 : undefined}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
