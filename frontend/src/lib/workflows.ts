import { API_ORIGIN } from "@/lib/env"

const API_BASE = `${API_ORIGIN}/api/v1/workflows`

export type WorkflowTriggerEvent =
  | "rfq.identified"
  | "rfq.draft_saved"
  | "rfq.order_placed"
  | "rfq.quote_sent"
  | "rfq.archived"
  | "form.submitted"

export interface WorkflowNodeData {
  id: string
  type: string
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export interface WorkflowEdgeData {
  id: string
  source: string
  sourceHandle: string | null
  target: string
}

export interface WorkflowSummaryRun {
  status: string
  startedAt: string | null
  finishedAt: string | null
}

export interface WorkflowRecord {
  _id: string
  name: string
  enabled: boolean
  trigger: { event: WorkflowTriggerEvent; formId?: string | null }
  nodes: WorkflowNodeData[]
  edges: WorkflowEdgeData[]
  createdAt: string
  updatedAt: string
  lastRun?: WorkflowSummaryRun | null
}

export interface WorkflowRunStep {
  nodeId: string
  nodeType: string
  status: "succeeded" | "failed" | "waiting"
  startedAt: string
  finishedAt: string | null
  output: string | null
  error: string | null
}

export interface WorkflowRunRecord {
  _id: string
  status: string
  currentNodeId: string | null
  steps: WorkflowRunStep[]
  approvalDecision: "approved" | "rejected" | null
  resumeAt: string | null
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
  createdAt: string
  rfqId: {
    _id: string
    customer: { name: string; company: string; email: string } | null
    quoteNumber: string | null
    workflowStatus: string
  } | null
  formId: {
    _id: string
    title: string
    slug: string
  } | null
  formSubmissionId: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function listWorkflows(): Promise<{ workflows: WorkflowRecord[] }> {
  return request("/")
}

export function getWorkflow(id: string): Promise<WorkflowRecord> {
  return request(`/${id}`)
}

export function createWorkflow(payload: {
  name: string
  nodes: WorkflowNodeData[]
  edges: WorkflowEdgeData[]
}): Promise<WorkflowRecord> {
  return request("/", { method: "POST", body: JSON.stringify(payload) })
}

export function updateWorkflow(
  id: string,
  payload: { name?: string; nodes?: WorkflowNodeData[]; edges?: WorkflowEdgeData[] }
): Promise<WorkflowRecord> {
  return request(`/${id}`, { method: "PUT", body: JSON.stringify(payload) })
}

export function setWorkflowEnabled(id: string, enabled: boolean): Promise<WorkflowRecord> {
  return request(`/${id}/enabled`, { method: "PATCH", body: JSON.stringify({ enabled }) })
}

export function deleteWorkflow(id: string): Promise<{ message: string }> {
  return request(`/${id}`, { method: "DELETE" })
}

export function listWorkflowRuns(id: string): Promise<{ runs: WorkflowRunRecord[] }> {
  return request(`/${id}/runs`)
}
