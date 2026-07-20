import type { DragEvent } from "react"

import { cn } from "@/lib/utils"

import {
  CATEGORY_STYLES,
  NODE_DEFINITIONS,
  type WorkflowNodeCategory,
  type WorkflowNodeDefinition,
} from "./node-definitions"
import { useWorkflowBuilderStore } from "./store"

export const NODE_DRAG_MIME = "application/inboundr-workflow-node"

const CATEGORY_ORDER: Array<{ category: WorkflowNodeCategory; label: string }> = [
  { category: "trigger", label: "Triggers" },
  { category: "action", label: "Actions" },
  { category: "logic", label: "Logic" },
]

function PaletteCard({
  definition,
  disabled,
}: {
  definition: WorkflowNodeDefinition
  disabled: boolean
}) {
  const styles = CATEGORY_STYLES[definition.category]
  const Icon = definition.icon

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(NODE_DRAG_MIME, definition.type)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border bg-card p-2.5 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "cursor-grab hover:border-ring/40 hover:bg-muted/50 active:cursor-grabbing"
      )}
      title={disabled ? "A workflow can only have one trigger" : undefined}
    >
      <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", styles.iconWrap)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight">{definition.label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {definition.description}
        </p>
      </div>
    </div>
  )
}

export function NodePalette() {
  const hasTrigger = useWorkflowBuilderStore((state) =>
    state.nodes.some((node) => (node.type ?? "").startsWith("trigger."))
  )

  return (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Nodes</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Drag a node onto the canvas, then connect the steps.
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {CATEGORY_ORDER.map(({ category, label }) => (
          <div key={category}>
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <div className="space-y-1.5">
              {NODE_DEFINITIONS.filter((definition) => definition.category === category).map(
                (definition) => (
                  <PaletteCard
                    key={definition.type}
                    definition={definition}
                    disabled={category === "trigger" && hasTrigger}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
