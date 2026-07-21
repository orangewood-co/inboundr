import { useMemo, useState, type DragEvent } from "react"
import { useReactFlow } from "@xyflow/react"
import { PlusIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

function PaletteRow({
  definition,
  disabled,
  onAdd,
}: {
  definition: WorkflowNodeDefinition
  disabled: boolean
  onAdd: (type: string) => void
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
      onClick={() => !disabled && onAdd(definition.type)}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-grab hover:border-border hover:bg-muted/60 active:cursor-grabbing"
      )}
      title={
        disabled ? "A workflow can only have one trigger" : definition.description
      }
    >
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-[5px] shadow-sm",
          styles.iconSolid
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
        {definition.label}
      </p>
      {!disabled && (
        <PlusIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  )
}

export function NodePalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const { screenToFlowPosition } = useReactFlow()
  const addNode = useWorkflowBuilderStore((state) => state.addNode)
  const hasTrigger = useWorkflowBuilderStore((state) =>
    state.nodes.some((node) => (node.type ?? "").startsWith("trigger."))
  )

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return CATEGORY_ORDER.map(({ category, label }) => ({
      category,
      label,
      definitions: NODE_DEFINITIONS.filter(
        (definition) =>
          definition.category === category &&
          (!needle ||
            definition.label.toLowerCase().includes(needle) ||
            definition.description.toLowerCase().includes(needle))
      ),
    })).filter((section) => section.definitions.length > 0)
  }, [query])

  const addAtViewportCenter = (type: string) => {
    // Drop near the middle of the canvas, slightly jittered so repeated
    // clicks don't stack nodes exactly on top of each other.
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
    })
    addNode(type, position)
    onClose()
  }

  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-10 flex w-72 flex-col overflow-hidden border-l bg-background shadow-xl transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      )}
      aria-hidden={!open}
    >
      <div className="space-y-2.5 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="px-1 text-sm font-semibold">Add a Step</h2>
            <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">
              Drag onto the canvas, or click to add.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onClose}
            aria-label="Close panel"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search steps…"
            className="h-8 pl-8 text-xs md:text-xs"
          />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {sections.map(({ category, label, definitions }) => (
          <div key={category}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <div className="space-y-0.5">
              {definitions.map((definition) => (
                <PaletteRow
                  key={definition.type}
                  definition={definition}
                  disabled={category === "trigger" && hasTrigger}
                  onAdd={addAtViewportCenter}
                />
              ))}
            </div>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No steps match “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  )
}
