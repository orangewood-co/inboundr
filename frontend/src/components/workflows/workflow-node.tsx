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
  isNodeConfigComplete,
  type WorkflowFieldDefinition,
} from "./node-definitions"
import { useWorkflowBuilderStore, type BuilderNode } from "./store"

const HANDLE_BASE =
  "size-3! rounded-full! border-2! border-background! shadow-sm! transition-transform! hover:scale-125!"

const FILLED_INPUT =
  "nodrag border-transparent bg-muted/60 shadow-none placeholder:text-muted-foreground/60 hover:bg-muted focus-visible:bg-background dark:bg-muted/40 dark:hover:bg-muted/60 dark:focus-visible:bg-input/30"

function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="nodrag inline-flex size-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
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
            <span className="font-mono text-[10px] text-muted-foreground">
              {variable.token}
            </span>
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
      <div className="flex h-5 items-center justify-between">
        <label className="text-[11px] font-medium text-muted-foreground">
          {field.label}
        </label>
        {field.supportsVariables && <VariablePicker onInsert={insertVariable} />}
      </div>

      {field.type === "textarea" ? (
        <textarea
          className={cn(
            "flex min-h-20 w-full resize-none rounded-md border px-2.5 py-2 text-xs leading-relaxed outline-none transition-[color,background-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            FILLED_INPUT
          )}
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) => updateNodeConfig(nodeId, field.key, event.target.value)}
        />
      ) : field.type === "select" ? (
        <Select
          value={stringValue || undefined}
          onValueChange={(next) => updateNodeConfig(nodeId, field.key, next)}
        >
          <SelectTrigger size="sm" className={cn("h-8 w-full text-xs", FILLED_INPUT)}>
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
          className={cn("h-8 text-xs md:text-xs", FILLED_INPUT)}
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
  const complete = isNodeConfigComplete(definition, config)

  return (
    <div
      className={cn(
        "w-72 rounded-xl border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color]",
        selected
          ? cn("shadow-lg ring-2", styles.selectedRing)
          : "hover:border-ring/40 hover:shadow-md"
      )}
    >
      {definition.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(HANDLE_BASE, "bg-muted-foreground!")}
        />
      )}

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-t-[calc(0.75rem-1px)] border-b px-3.5 py-2.5",
          styles.headerTint
        )}
      >
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md shadow-sm",
            styles.iconSolid
          )}
        >
          <Icon className="size-4" />
        </div>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {definition.label}
        </p>
        {!complete && (
          <span
            className="size-2 shrink-0 rounded-full bg-amber-500 ring-3 ring-amber-500/20"
            title="This step needs configuration"
          />
        )}
      </div>

      {/* Body */}
      {definition.fields.length > 0 ? (
        <div className="space-y-2.5 px-3.5 py-3">
          {definition.fields.map((field) => (
            <NodeField key={field.key} nodeId={id} field={field} value={config[field.key]} />
          ))}
        </div>
      ) : (
        <div className="px-3.5 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {definition.description}
          </p>
        </div>
      )}

      {multiOutput ? (
        <div className="border-t">
          {definition.outputs.map((output, index) => (
            <div
              key={output.id ?? index}
              className="relative flex items-center justify-end px-3.5 py-1.5"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    output.id === "rejected" ? "bg-red-500" : "bg-emerald-500"
                  )}
                />
                {output.label}
              </span>
              <Handle
                id={output.id ?? undefined}
                type="source"
                position={Position.Right}
                className={cn(
                  HANDLE_BASE,
                  output.id === "rejected" ? "bg-red-500!" : "bg-emerald-500!"
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
          className={cn(HANDLE_BASE, styles.handle)}
        />
      )}
    </div>
  )
})
