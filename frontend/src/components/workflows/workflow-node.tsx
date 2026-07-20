import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BracesIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import {
  CATEGORY_STYLES,
  NODE_DEFINITION_MAP,
  TEMPLATE_VARIABLES,
  type WorkflowFieldDefinition,
} from "./node-definitions"
import { useWorkflowBuilderStore, type BuilderNode } from "./store"

function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="nodrag inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Insert a variable"
        >
          <BracesIcon className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
        {TEMPLATE_VARIABLES.map((variable) => (
          <DropdownMenuItem
            key={variable.token}
            onSelect={() => onInsert(variable.token)}
            className="flex-col items-start gap-0"
          >
            <span className="text-xs font-medium">{variable.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{variable.token}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NodeField({
  nodeId,
  field,
  value,
}: {
  nodeId: string
  field: WorkflowFieldDefinition
  value: unknown
}) {
  const updateNodeConfig = useWorkflowBuilderStore((state) => state.updateNodeConfig)
  const stringValue = value == null ? "" : String(value)

  const insertVariable = (token: string) => {
    updateNodeConfig(nodeId, field.key, `${stringValue}${stringValue ? " " : ""}${token}`)
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {field.label}
        </label>
        {field.supportsVariables && <VariablePicker onInsert={insertVariable} />}
      </div>

      {field.type === "textarea" ? (
        <textarea
          className="nodrag flex min-h-16 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) => updateNodeConfig(nodeId, field.key, event.target.value)}
        />
      ) : field.type === "select" ? (
        <Select
          value={stringValue || undefined}
          onValueChange={(next) => updateNodeConfig(nodeId, field.key, next)}
        >
          <SelectTrigger size="sm" className="nodrag h-7 w-full text-xs">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={field.type === "number" ? "number" : "text"}
          className="nodrag h-7 text-xs md:text-xs"
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) =>
            updateNodeConfig(
              nodeId,
              field.key,
              field.type === "number" ? event.target.valueAsNumber || "" : event.target.value
            )
          }
        />
      )}
    </div>
  )
}

export const WorkflowNodeComponent = memo(function WorkflowNodeComponent({
  id,
  type,
  data,
  selected,
}: NodeProps<BuilderNode>) {
  const definition = NODE_DEFINITION_MAP.get(type ?? "")
  if (!definition) return null

  const styles = CATEGORY_STYLES[definition.category]
  const Icon = definition.icon
  const config = data.config ?? {}
  const multiOutput = definition.outputs.length > 1

  return (
    <div
      className={cn(
        "w-64 rounded-xl border border-t-2 bg-card text-card-foreground shadow-sm transition-shadow",
        styles.accent,
        selected && "shadow-md ring-2 ring-ring/40"
      )}
    >
      {definition.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="size-2.5! rounded-full! border-2! border-background! bg-muted-foreground!"
        />
      )}

      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", styles.iconWrap)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">{definition.label}</p>
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-widest",
              styles.badge,
              "rounded-sm bg-transparent! px-0"
            )}
          >
            {definition.category}
          </span>
        </div>
      </div>

      {definition.fields.length > 0 ? (
        <div className="space-y-2.5 px-3 py-2.5">
          {definition.fields.map((field) => (
            <NodeField key={field.key} nodeId={id} field={field} value={config[field.key]} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-2.5">
          <p className="text-[11px] leading-snug text-muted-foreground">{definition.description}</p>
        </div>
      )}

      {multiOutput ? (
        <div className="relative border-t">
          {definition.outputs.map((output, index) => (
            <div key={output.id ?? index} className="relative flex items-center justify-end px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {output.label}
              </span>
              <Handle
                id={output.id ?? undefined}
                type="source"
                position={Position.Right}
                className={cn(
                  "size-2.5! rounded-full! border-2! border-background!",
                  output.id === "rejected" ? "bg-destructive!" : "bg-emerald-500!"
                )}
                style={{ top: "50%" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="size-2.5! rounded-full! border-2! border-background! bg-muted-foreground!"
        />
      )}
    </div>
  )
})
