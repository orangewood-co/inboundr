import { useCallback, useMemo, useState, type DragEvent } from "react"
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react"

import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

import { NODE_DEFINITIONS } from "./node-definitions"
import { NodePalette, NODE_DRAG_MIME } from "./node-palette"
import { useWorkflowBuilderStore } from "./store"
import { WorkflowNodeComponent } from "./workflow-node"

const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_DEFINITIONS.map((definition) => [definition.type, WorkflowNodeComponent])
)

const proOptions = { hideAttribution: true }

const defaultEdgeOptions = {
  type: ConnectionLineType.Bezier,
  style: { strokeWidth: 2.5 },
}

const snapGrid: [number, number] = [16, 16]

function EditorCanvas() {
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()
  const { theme } = useTheme()

  const name = useWorkflowBuilderStore((state) => state.name)
  const nodes = useWorkflowBuilderStore((state) => state.nodes)
  const edges = useWorkflowBuilderStore((state) => state.edges)
  const onNodesChange = useWorkflowBuilderStore((state) => state.onNodesChange)
  const onEdgesChange = useWorkflowBuilderStore((state) => state.onEdgesChange)
  const onConnect = useWorkflowBuilderStore((state) => state.onConnect)
  const addNode = useWorkflowBuilderStore((state) => state.addNode)
  const setName = useWorkflowBuilderStore((state) => state.setName)

  const [paletteOpen, setPaletteOpen] = useState(false)

  const colorMode = useMemo(() => (theme === "system" ? "system" : theme), [theme])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(NODE_DRAG_MIME)
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
      setPaletteOpen(false)
    },
    [addNode, screenToFlowPosition]
  )

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          colorMode={colorMode}
          proOptions={proOptions}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.Bezier}
          connectionRadius={36}
          snapToGrid
          snapGrid={snapGrid}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
          <Controls
            position="bottom-left"
            className="gap-px! overflow-hidden! rounded-lg! border! border-border! bg-background/95! shadow-sm! backdrop-blur! *:border-none! *:bg-transparent! hover:*:bg-muted!"
          />
          <Panel position="top-left">
            <div className="flex items-center gap-2 rounded-xl border bg-background/95 p-1.5 shadow-sm backdrop-blur">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => navigate({ to: "/workflows" })}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <div className="relative flex items-center">
                <input
                  id="workflow-name-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-8 w-52 rounded-md border border-transparent bg-transparent px-2 pr-7 text-sm font-semibold outline-none transition-colors hover:border-input focus:border-ring"
                  placeholder="Workflow name"
                />
                <PencilIcon className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
              </div>
              <span className="border-l py-0.5 pl-2.5 pr-1.5 text-[11px] tabular-nums text-muted-foreground">
                {nodes.length} {nodes.length === 1 ? "step" : "steps"}
              </span>
            </div>
          </Panel>

          <Panel position="top-right">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg bg-background/95 shadow-sm backdrop-blur"
              onClick={() => setPaletteOpen((open) => !open)}
              title="Add a step"
            >
              <PlusIcon className="size-4" />
            </Button>
          </Panel>
        </ReactFlow>
        <NodePalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </div>
  )
}

export function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <EditorCanvas />
    </ReactFlowProvider>
  )
}
