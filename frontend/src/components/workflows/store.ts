import { create } from "zustand"
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react"

import type { WorkflowEdgeData, WorkflowNodeData } from "@/lib/workflows"
import { defaultConfigForNode } from "./node-definitions"

export type BuilderNode = Node<{ config: Record<string, unknown> }>

interface WorkflowBuilderState {
  workflowId: string | null
  name: string
  enabled: boolean
  nodes: BuilderNode[]
  edges: Edge[]
  dirty: boolean
  hydrate: (workflow: {
    _id: string
    name: string
    enabled: boolean
    nodes: WorkflowNodeData[]
    edges: WorkflowEdgeData[]
  }) => void
  setName: (name: string) => void
  setEnabled: (enabled: boolean) => void
  markSaved: () => void
  onNodesChange: (changes: NodeChange<BuilderNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  updateNodeConfig: (nodeId: string, key: string, value: unknown) => void
  serializeGraph: () => { nodes: WorkflowNodeData[]; edges: WorkflowEdgeData[] }
}

let nodeCounter = 0

function nextNodeId(): string {
  nodeCounter += 1
  return `node_${Date.now().toString(36)}_${nodeCounter}`
}

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
  workflowId: null,
  name: "",
  enabled: false,
  nodes: [],
  edges: [],
  dirty: false,

  hydrate: (workflow) =>
    set({
      workflowId: workflow._id,
      name: workflow.name,
      enabled: workflow.enabled,
      dirty: false,
      nodes: workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: { config: node.config ?? {} },
      })),
      edges: workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? undefined,
        target: edge.target,
      })),
    }),

  setName: (name) => set({ name, dirty: true }),
  setEnabled: (enabled) => set({ enabled }),
  markSaved: () => set({ dirty: false }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      // "select" and automatic "dimensions" changes are not user edits.
      dirty:
        state.dirty ||
        changes.some((change) => change.type !== "select" && change.type !== "dimensions"),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      dirty: state.dirty || changes.some((change) => change.type !== "select"),
    })),

  onConnect: (connection) =>
    set((state) => {
      if (!connection.source || !connection.target) return state
      if (connection.source === connection.target) return state
      // One connection per output handle: replace any existing edge from the
      // same source handle.
      const filtered = state.edges.filter(
        (edge) =>
          !(
            edge.source === connection.source &&
            (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null)
          )
      )
      return {
        edges: [
          ...filtered,
          {
            id: `edge_${connection.source}_${connection.sourceHandle ?? "out"}_${connection.target}`,
            source: connection.source,
            sourceHandle: connection.sourceHandle ?? undefined,
            target: connection.target,
          },
        ],
        dirty: true,
      }
    }),

  addNode: (type, position) =>
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id: nextNodeId(),
          type,
          position,
          data: { config: defaultConfigForNode(type) },
        },
      ],
      dirty: true,
    })),

  updateNodeConfig: (nodeId, key, value) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { config: { ...node.data.config, [key]: value } } }
          : node
      ),
      dirty: true,
    })),

  serializeGraph: () => {
    const { nodes, edges } = get()
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type ?? "",
        position: { x: node.position.x, y: node.position.y },
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? null,
        target: edge.target,
      })),
    }
  },
}))
