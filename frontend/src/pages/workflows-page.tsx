import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  HistoryIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  WorkflowIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  NODE_DEFINITION_MAP,
  TRIGGER_EVENT_LABELS,
} from "@/components/workflows/node-definitions"
import { formatFullDateTime, formatListTimestamp } from "@/lib/format"
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflowRuns,
  listWorkflows,
  setWorkflowEnabled,
  type WorkflowRecord,
  type WorkflowRunRecord,
} from "@/lib/workflows"
import { cn } from "@/lib/utils"

const RUN_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  waiting_approval: {
    label: "Waiting approval",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  waiting_delay: {
    label: "Waiting delay",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
}

function RunStatusBadge({ status }: { status: string }) {
  const style = RUN_STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        style.className
      )}
    >
      {style.label}
    </span>
  )
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2Icon className="size-3.5 text-emerald-500" />
  if (status === "failed") return <XCircleIcon className="size-3.5 text-destructive" />
  if (status === "waiting") return <ClockIcon className="size-3.5 text-amber-500" />
  return <CircleIcon className="size-3.5 text-muted-foreground" />
}

function RunsSheet({
  workflow,
  onClose,
}: {
  workflow: WorkflowRecord | null
  onClose: () => void
}) {
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workflow) return
    let cancelled = false
    setLoading(true)
    listWorkflowRuns(workflow._id)
      .then((data) => {
        if (!cancelled) setRuns(data.runs)
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load workflow runs")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workflow])

  return (
    <Sheet open={!!workflow} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Run History</SheetTitle>
          <SheetDescription>
            Recent runs of &ldquo;{workflow?.name}&rdquo;, newest first.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No runs yet. Enable the workflow and trigger it from the RFQ flow.
              </p>
            </div>
          ) : (
            runs.map((run) => (
              <div key={run._id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <RunStatusBadge status={run.status} />
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {formatFullDateTime(run.startedAt)}
                  </span>
                </div>

                {run.rfqId?.customer && (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    RFQ:{" "}
                    <span className="font-medium text-foreground">
                      {run.rfqId.customer.company || run.rfqId.customer.name}
                    </span>
                    {run.rfqId.quoteNumber && ` · ${run.rfqId.quoteNumber}`}
                  </p>
                )}

                <div className="mt-2.5 space-y-1.5 border-t pt-2.5">
                  {run.steps.map((step, index) => {
                    const definition = NODE_DEFINITION_MAP.get(step.nodeType)
                    return (
                      <div key={`${step.nodeId}-${index}`} className="flex items-start gap-2">
                        <StepStatusIcon status={step.status} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-tight">
                            {definition?.label ?? step.nodeType}
                          </p>
                          {(step.output || step.error) && (
                            <p
                              className={cn(
                                "mt-0.5 line-clamp-2 text-[11px] leading-snug",
                                step.error ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              {step.error ?? step.output}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {run.errorMessage && run.status === "failed" && (
                  <p className="mt-2 rounded-md bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                    {run.errorMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-6">
        <WorkflowIcon className="size-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No Workflows Yet</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground/60">
          Build node-based automations on top of the RFQ and Orders flow — approvals, emails,
          order placement, and more.
        </p>
      </div>
      <Button onClick={onCreate} disabled={creating}>
        {creating ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
        Create Your First Workflow
      </Button>
    </div>
  )
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runsWorkflow, setRunsWorkflow] = useState<WorkflowRecord | null>(null)

  const fetchWorkflows = useCallback(async () => {
    setError(null)
    try {
      const data = await listWorkflows()
      setWorkflows(data.workflows)
    } catch (err: any) {
      setError(err.message || "Failed to load workflows")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const workflow = await createWorkflow({
        name: "Untitled Workflow",
        nodes: [
          {
            id: "trigger_1",
            type: "trigger.rfq_identified",
            position: { x: 80, y: 160 },
            config: {},
          },
        ],
        edges: [],
      })
      navigate({ to: "/workflows/$id", params: { id: workflow._id } })
    } catch (err: any) {
      toast.error(err.message || "Failed to create workflow")
      setCreating(false)
    }
  }

  const handleToggle = async (workflow: WorkflowRecord, enabled: boolean) => {
    setTogglingId(workflow._id)
    try {
      const updated = await setWorkflowEnabled(workflow._id, enabled)
      setWorkflows((current) =>
        current.map((item) =>
          item._id === workflow._id ? { ...item, enabled: updated.enabled } : item
        )
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update workflow")
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (workflow: WorkflowRecord) => {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return
    setDeletingId(workflow._id)
    try {
      await deleteWorkflow(workflow._id)
      setWorkflows((current) => current.filter((item) => item._id !== workflow._id))
      toast.success("Workflow deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete workflow")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout>
      <SiteHeader />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2.5">
            <WorkflowIcon className="size-4.5 text-muted-foreground" />
            <div>
              <h1 className="text-base font-semibold leading-tight">Workflows</h1>
              <p className="text-xs text-muted-foreground">
                Automations that react to RFQ and order events.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={refreshing}
                  onClick={() => {
                    setRefreshing(true)
                    fetchWorkflows()
                  }}
                >
                  <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            {workflows.length > 0 && (
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
                New Workflow
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => {
                setRefreshing(true)
                fetchWorkflows()
              }}
            />
          ) : workflows.length === 0 ? (
            <EmptyState onCreate={handleCreate} creating={creating} />
          ) : (
            <div className="animate-in fade-in-0 space-y-2 p-6 duration-300">
              {workflows.map((workflow) => {
                const lastRunStatus = workflow.lastRun?.status
                return (
                  <div
                    key={workflow._id}
                    className="group flex cursor-pointer items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-ring/40 hover:bg-muted/40"
                    onClick={() =>
                      navigate({ to: "/workflows/$id", params: { id: workflow._id } })
                    }
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        workflow.enabled
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <WorkflowIcon className="size-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{workflow.name}</p>
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {TRIGGER_EVENT_LABELS[workflow.trigger.event] ?? workflow.trigger.event}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {workflow.nodes.length} node{workflow.nodes.length === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span>Updated {formatListTimestamp(workflow.updatedAt)}</span>
                        {workflow.lastRun?.startedAt && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1.5">
                              Last run {formatListTimestamp(workflow.lastRun.startedAt)}
                              {lastRunStatus && <RunStatusBadge status={lastRunStatus} />}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex shrink-0 items-center gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setRunsWorkflow(workflow)}
                          >
                            <HistoryIcon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Run history</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            disabled={deletingId === workflow._id}
                            onClick={() => handleDelete(workflow)}
                          >
                            {deletingId === workflow._id ? (
                              <Spinner className="size-4" />
                            ) : (
                              <Trash2Icon className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                      <div className="ml-1 border-l pl-3">
                        <Switch
                          checked={workflow.enabled}
                          disabled={togglingId === workflow._id}
                          onCheckedChange={(checked) => handleToggle(workflow, checked)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <RunsSheet workflow={runsWorkflow} onClose={() => setRunsWorkflow(null)} />
    </AppLayout>
  )
}
