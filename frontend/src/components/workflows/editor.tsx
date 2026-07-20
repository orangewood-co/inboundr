import { useCallback, useMemo, useState, type DragEvent } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"

import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/components/theme-provider"
import { setWorkflowEnabled, updateWorkflow } from "@/lib/workflows"

import { NODE_DEFINITIONS } from "./node-definitions"
import { NodePalette, NODE_DRAG_MIME } from "./node-palette"
import { useWorkflowBuilderStore } from "./store"
import { WorkflowNodeComponent } from "./workflow-node"

const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_DEFINITIONS.map((definition) => [definition.type, WorkflowNodeComponent])
)

const proOptions = { hideAttribution: true }

function EditorCanvas() {
  const navigate = useNavigate()
  const { screenToFlowPosition } = useReactFlow()
  const { theme } = useTheme()

  const workflowId = useWorkflowBuilderStore((state) => state.workflowId)
  const name = useWorkflowBuilderStore((state) => state.name)
  const enabled = useWorkflowBuilderStore((state) => state.enabled)
  const nodes = useWorkflowBuilderStore((state) => state.nodes)
  const edges = useWorkflowBuilderStore((state) => state.edges)
  const dirty = useWorkflowBuilderStore((state) => state.dirty)
  const onNodesChange = useWorkflowBuilderStore((state) => state.onNodesChange)
  const onEdgesChange = useWorkflowBuilderStore((state) => state.onEdgesChange)
  const onConnect = useWorkflowBuilderStore((state) => state.onConnect)
  const addNode = useWorkflowBuilderStore((state) => state.addNode)
  const setName = useWorkflowBuilderStore((state) => state.setName)
  const setEnabled = useWorkflowBuilderStore((state) => state.setEnabled)
  const markSaved = useWorkflowBuilderStore((state) => state.markSaved)
  const serializeGraph = useWorkflowBuilderStore((state) => state.serializeGraph)

  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

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
    },
    [addNode, screenToFlowPosition]
  )

  const handleSave = async () => {
    if (!workflowId) return
    setSaving(true)
    try {
      const graph = serializeGraph()
      await updateWorkflow(workflowId, { name, ...graph })
      markSaved()
      toast.success("Workflow saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save workflow")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (next: boolean) => {
    if (!workflowId) return
    if (next && dirty) {
      toast.error("Save the workflow before enabling it")
      return
    }
    setToggling(true)
    try {
      const workflow = await setWorkflowEnabled(workflowId, next)
      setEnabled(workflow.enabled)
      toast.success(workflow.enabled ? "Workflow enabled" : "Workflow disabled")
    } catch (err: any) {
      toast.error(err.message || "Failed to update workflow")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <NodePalette />
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
          defaultEdgeOptions={{ animated: true }}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
          <Controls position="bottom-left" />
          <MiniMap position="bottom-right" pannable zoomable className="rounded-lg!" />

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
              <div className="flex items-center gap-1.5 border-l pl-2 pr-1 text-[11px] tabular-nums text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">{nodes.length} nodes</span>
                <span className="rounded-full bg-muted px-2 py-0.5">{edges.length} edges</span>
              </div>
            </div>
          </Panel>

          <Panel position="top-right">
            <div className="flex items-center gap-3 rounded-xl border bg-background/95 p-1.5 pl-3 shadow-sm backdrop-blur">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <Switch
                  checked={enabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={toggling}
                />
                {enabled ? "Enabled" : "Disabled"}
              </label>
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving && <Spinner data-icon="inline-start" />}
                {dirty ? "Save" : "Saved"}
              </Button>
            </div>
          </Panel>
        </ReactFlow>
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
