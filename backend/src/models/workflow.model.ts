import mongoose, { Schema, type Document, type Types } from "mongoose";

export const WORKFLOW_TRIGGER_EVENTS = [
  "rfq.identified",
  "rfq.draft_saved",
  "rfq.order_placed",
  "rfq.quote_sent",
  "rfq.archived",
  "form.submitted",
] as const;
export type WorkflowTriggerEvent = (typeof WORKFLOW_TRIGGER_EVENTS)[number];

export const WORKFLOW_NODE_TYPES = [
  "trigger.rfq_identified",
  "trigger.rfq_draft_saved",
  "trigger.rfq_order_placed",
  "trigger.rfq_quote_sent",
  "trigger.rfq_archived",
  "trigger.form_submitted",
  "action.send_email",
  "action.request_approval",
  "action.place_order",
  "action.archive_rfq",
  "action.notify",
  "logic.delay",
] as const;
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const TRIGGER_NODE_EVENT_MAP: Record<string, WorkflowTriggerEvent> = {
  "trigger.rfq_identified": "rfq.identified",
  "trigger.rfq_draft_saved": "rfq.draft_saved",
  "trigger.rfq_order_placed": "rfq.order_placed",
  "trigger.rfq_quote_sent": "rfq.quote_sent",
  "trigger.rfq_archived": "rfq.archived",
  "trigger.form_submitted": "form.submitted",
};

/** Actions that operate on the triggering RFQ and make no sense for form runs. */
export const RFQ_ONLY_NODE_TYPES: WorkflowNodeType[] = [
  "action.place_order",
  "action.archive_rfq",
];

export interface IWorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
}

export interface IWorkflow extends Document {
  organizationId: Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: { event: WorkflowTriggerEvent; formId: Types.ObjectId | null };
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const workflowNodeSchema = new Schema<IWorkflowNode>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: WORKFLOW_NODE_TYPES, required: true },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    config: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const workflowEdgeSchema = new Schema<IWorkflowEdge>(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    sourceHandle: { type: String, default: null },
    target: { type: String, required: true },
  },
  { _id: false }
);

const workflowSchema = new Schema<IWorkflow>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false, index: true },
    trigger: {
      event: { type: String, enum: WORKFLOW_TRIGGER_EVENTS, required: true },
      formId: { type: Schema.Types.ObjectId, ref: "Form", default: null },
    },
    nodes: { type: [workflowNodeSchema], default: [] },
    edges: { type: [workflowEdgeSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

workflowSchema.index({ organizationId: 1, updatedAt: -1 });
workflowSchema.index({ enabled: 1, "trigger.event": 1, "trigger.formId": 1 });

export const Workflow = mongoose.model<IWorkflow>("Workflow", workflowSchema);

export interface WorkflowGraphValidationResult {
  valid: boolean;
  error?: string;
  triggerNode?: IWorkflowNode;
}

/**
 * Validates a workflow graph: exactly one trigger node, valid node types,
 * unique node ids, edges referencing known nodes, no cycles, and every
 * non-trigger node reachable from the trigger.
 */
export function validateWorkflowGraph(
  nodes: IWorkflowNode[],
  edges: IWorkflowEdge[]
): WorkflowGraphValidationResult {
  if (!nodes.length) {
    return { valid: false, error: "Workflow has no nodes" };
  }

  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id) return { valid: false, error: "A node is missing an id" };
    if (ids.has(node.id)) {
      return { valid: false, error: `Duplicate node id: ${node.id}` };
    }
    ids.add(node.id);
    if (!WORKFLOW_NODE_TYPES.includes(node.type)) {
      return { valid: false, error: `Unknown node type: ${node.type}` };
    }
  }

  const triggerNodes = nodes.filter((node) => node.type.startsWith("trigger."));
  if (triggerNodes.length === 0) {
    return { valid: false, error: "Workflow needs a trigger node" };
  }
  if (triggerNodes.length > 1) {
    return { valid: false, error: "Workflow can only have one trigger node" };
  }
  const triggerNode = triggerNodes[0]!;

  if (triggerNode.type === "trigger.form_submitted") {
    const formId = triggerNode.config?.formId;
    if (typeof formId !== "string" || !formId.trim()) {
      return { valid: false, error: "The Form Submitted trigger needs a form selected" };
    }
    const rfqOnlyNode = nodes.find((node) =>
      RFQ_ONLY_NODE_TYPES.includes(node.type)
    );
    if (rfqOnlyNode) {
      return {
        valid: false,
        error: "Place Order and Archive RFQ nodes cannot be used with a form trigger",
      };
    }
  }

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      return { valid: false, error: "An edge references a missing node" };
    }
    if (edge.target === triggerNode.id) {
      return { valid: false, error: "The trigger node cannot have incoming connections" };
    }
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  // Every node except approval (two branches) must have at most one outgoing
  // edge per handle; enforce linear flow by handle.
  const handleSeen = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.source}:${edge.sourceHandle ?? "default"}`;
    if (handleSeen.has(key)) {
      return { valid: false, error: "Each output can only connect to one node" };
    }
    handleSeen.add(key);
  }

  // Cycle detection + reachability from the trigger (iterative DFS).
  const visited = new Set<string>();
  const stack: Array<{ id: string; path: Set<string> }> = [
    { id: triggerNode.id, path: new Set([triggerNode.id]) },
  ];
  while (stack.length) {
    const { id, path } = stack.pop()!;
    visited.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (path.has(next)) {
        return { valid: false, error: "Workflow contains a cycle" };
      }
      stack.push({ id: next, path: new Set([...path, next]) });
    }
  }

  const unreachable = nodes.find((node) => !visited.has(node.id));
  if (unreachable) {
    return {
      valid: false,
      error: "All nodes must be connected to the trigger",
    };
  }

  return { valid: true, triggerNode };
}
