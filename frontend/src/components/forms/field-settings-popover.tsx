import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  FIELD_TYPE_META,
  FIELD_TYPE_ORDER,
  type FieldType,
  type FormField,
} from "@/components/forms/types"

export function FieldSettingsPopover({
  field,
  onChange,
  children,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
  children: React.ReactNode
}) {
  function changeType(type: FieldType) {
    const patch: Partial<FormField> = { type }
    if ((type === "dropdown" || type === "checkbox") && (field.options ?? []).length === 0) {
      patch.options = ["Option 1"]
    }
    onChange(patch)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-[13px] font-medium">Question Settings</p>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Question type</Label>
            <div className="grid grid-cols-2 gap-1">
              {FIELD_TYPE_ORDER.map((type) => {
                const meta = FIELD_TYPE_META[type]
                const Icon = meta.icon
                const isActive = field.type === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => changeType(type)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium">Required</p>
              <p className="text-xs text-muted-foreground">Respondent must answer</p>
            </div>
            <Switch
              checked={field.required}
              onCheckedChange={(checked) => onChange({ required: checked })}
            />
          </div>

          {field.type === "file" && (
            <div className="space-y-3 rounded-lg bg-muted/40 p-3">
              <p className="text-xs font-medium">File upload settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max size (MB)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={field.maxFileSizeMb ?? 10}
                    onChange={(event) => onChange({ maxFileSizeMb: Number(event.target.value) })}
                    className="h-8"
                  />
                </div>
                <div className="flex items-end justify-between gap-2 pb-1">
                  <Label className="text-xs text-muted-foreground">Multiple files</Label>
                  <Switch
                    checked={Boolean(field.multiple)}
                    onCheckedChange={(checked) => onChange({ multiple: checked })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Allowed types</Label>
                <Input
                  value={(field.allowedMimeTypes ?? []).join(", ")}
                  placeholder="application/pdf, image/png"
                  onChange={(event) =>
                    onChange({
                      allowedMimeTypes: event.target.value
                        .split(",")
                        .map((mime) => mime.trim().toLowerCase())
                        .filter(Boolean),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Leave empty to allow any file type.</p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
