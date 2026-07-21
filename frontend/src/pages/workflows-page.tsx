import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  ClockIcon,
  HistoryIcon,
  ListIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  WorkflowIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NODE_DEFINITION_MAP } from "@/components/workflows/node-definitions"
import { formatFullDateTime, formatListTimestamp } from "@/lib/format"
import {
  createWorkflow,
  deleteWorkflow,
  listAllRuns,
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

const RUN_STATUS_CELLS: Record<string, { label: string; icon: typeof CircleIcon; className: string }> = {
  running: { label: "Running", icon: Loader2Icon, className: "text-sky-500 animate-spin" },
  waiting_approval: { label: "Waiting approval", icon: ClockIcon, className: "text-amber-500" },
  waiting_delay: { label: "Waiting delay", icon: ClockIcon, className: "text-amber-500" },
  completed: { label: "Success", icon: CheckCircle2Icon, className: "text-emerald-500" },
  failed: { label: "Error", icon: XCircleIcon, className: "text-red-500" },
  rejected: { label: "Rejected", icon: XCircleIcon, className: "text-red-500" },
}

function RunStatusCell({ status }: { status: string }) {
  const cell = RUN_STATUS_CELLS[status] ?? {
    label: status,
    icon: CircleIcon,
    className: "text-muted-foreground",
  }
  const Icon = cell.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <Icon className={cn("size-4 shrink-0", cell.className)} />
      {cell.label}
    </span>
  )
}

const startedAtFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function formatDuration(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 1) return "<1s"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function runContext(run: WorkflowRunRecord): string | null {
  if (run.rfqId?.customer) {
    const who = run.rfqId.customer.company || run.rfqId.customer.name
    return run.rfqId.quoteNumber ? `${who} · ${run.rfqId.quoteNumber}` : who
  }
  if (run.formId) return run.formId.title || "Untitled form"
  return null
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative w-full max-w-64">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-xs md:text-xs"
      />
    </div>
  )
}

function PaginationFooter({
  page,
  totalPages,
  onPageChange,
  disabled,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  return (
    <div className="mt-auto flex items-center justify-between border-t px-6 py-3">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
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

function ListEmptyMessage({ icon: Icon, message }: { icon: typeof ListIcon; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

const WORKFLOWS_PAGE_SIZE = 10

function WorkflowsTab({
  workflows,
  loading,
  error,
  creating,
  onRetry,
  onCreate,
  onToggle,
  onDelete,
  onShowRuns,
  togglingId,
  deletingId,
}: {
  workflows: WorkflowRecord[]
  loading: boolean
  error: string | null
  creating: boolean
  onRetry: () => void
  onCreate: () => void
  onToggle: (workflow: WorkflowRecord, enabled: boolean) => void
  onDelete: (workflow: WorkflowRecord) => void
  onShowRuns: (workflow: WorkflowRecord) => void
  togglingId: string | null
  deletingId: string | null
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [enabledFilter, setEnabledFilter] = useState("all")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return workflows.filter((workflow) => {
      if (needle && !workflow.name.toLowerCase().includes(needle)) return false
      if (enabledFilter === "enabled" && !workflow.enabled) return false
      if (enabledFilter === "disabled" && workflow.enabled) return false
      return true
    })
  }, [workflows, search, enabledFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / WORKFLOWS_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice(
    (currentPage - 1) * WORKFLOWS_PAGE_SIZE,
    currentPage * WORKFLOWS_PAGE_SIZE
  )

  const updateSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const updateFilter = (value: string) => {
    setEnabledFilter(value)
    setPage(1)
  }

  if (loading) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (workflows.length === 0) {
    return <EmptyState onCreate={onCreate} creating={creating} />
  }

  return (
    <>
      <div className="flex items-center gap-2 px-6 pt-4">
        <SearchField value={search} onChange={updateSearch} placeholder="Search workflows…" />
        <Select value={enabledFilter} onValueChange={updateFilter}>
          <SelectTrigger size="sm" className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Workflows
            </SelectItem>
            <SelectItem value="enabled" className="text-xs">
              Enabled
            </SelectItem>
            <SelectItem value="disabled" className="text-xs">
              Disabled
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pageItems.length === 0 ? (
        <ListEmptyMessage icon={SearchIcon} message="No workflows match your search." />
      ) : (
        <div className="animate-in fade-in-0 flex-1 space-y-2 overflow-y-auto p-6 pt-4 duration-300">
          {pageItems.map((workflow) => (
            <div
              key={workflow._id}
              className="group flex cursor-pointer items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-ring/40 hover:bg-muted/40"
              onClick={() => navigate({ to: "/workflows/$id", params: { id: workflow._id } })}
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
                <p className="truncate text-sm font-semibold">{workflow.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {workflow.nodes.length} step{workflow.nodes.length === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span>Updated {formatListTimestamp(workflow.updatedAt)}</span>
                  {workflow.lastRun?.startedAt && (
                    <>
                      <span>·</span>
                      <span>Last run {formatListTimestamp(workflow.lastRun.startedAt)}</span>
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
                      onClick={() => onShowRuns(workflow)}
                    >
                      <HistoryIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View executions</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === workflow._id}
                      onClick={() => onDelete(workflow)}
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
                    onCheckedChange={(checked) => onToggle(workflow, checked)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationFooter page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </>
  )
}

function RunDetailSheet({
  run,
  onClose,
}: {
  run: WorkflowRunRecord | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!run} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Execution Details</SheetTitle>
          <SheetDescription>
            {run?.workflowId?.name ? `Run of “${run.workflowId.name}”.` : "Workflow run."}
          </SheetDescription>
        </SheetHeader>

        {run && (
          <div className="space-y-4 px-4 pb-6">
            <div className="flex items-center justify-between gap-2">
              <RunStatusBadge status={run.status} />
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {formatFullDateTime(run.startedAt)}
              </span>
            </div>

            {runContext(run) && (
              <p className="truncate text-xs text-muted-foreground">
                {run.rfqId ? "RFQ: " : "Form: "}
                <span className="font-medium text-foreground">{runContext(run)}</span>
              </p>
            )}

            <div className="space-y-1.5 border-t pt-3">
              {run.steps.length === 0 ? (
                <p className="text-xs text-muted-foreground">No steps were executed.</p>
              ) : (
                run.steps.map((step, index) => {
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
                              "mt-0.5 line-clamp-3 text-[11px] leading-snug",
                              step.error ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            {step.error ?? step.output}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {run.errorMessage && run.status === "failed" && (
              <p className="rounded-md bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                {run.errorMessage}
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

const RUNS_PAGE_SIZE = 20

function ExecutionsTab({
  workflowFilter,
  onClearWorkflowFilter,
}: {
  workflowFilter: WorkflowRecord | null
  onClearWorkflowFilter: () => void
}) {
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRun, setSelectedRun] = useState<WorkflowRunRecord | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const fetchRuns = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await listAllRuns({
        page,
        limit: RUNS_PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        workflowId: workflowFilter?._id,
        search: debouncedSearch || undefined,
      })
      setRuns(data.runs)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executions")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, workflowFilter, debouncedSearch])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <SearchField value={search} onChange={setSearch} placeholder="Search by workflow name…" />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All Statuses
            </SelectItem>
            <SelectItem value="running" className="text-xs">
              Running
            </SelectItem>
            <SelectItem value="waiting_approval" className="text-xs">
              Waiting Approval
            </SelectItem>
            <SelectItem value="waiting_delay" className="text-xs">
              Waiting Delay
            </SelectItem>
            <SelectItem value="completed" className="text-xs">
              Completed
            </SelectItem>
            <SelectItem value="failed" className="text-xs">
              Failed
            </SelectItem>
            <SelectItem value="rejected" className="text-xs">
              Rejected
            </SelectItem>
          </SelectContent>
        </Select>
        {workflowFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 py-1 pl-3 pr-1.5 text-[11px] font-medium">
            {workflowFilter.name}
            <button
              type="button"
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
              onClick={() => {
                onClearWorkflowFilter()
                setPage(1)
              }}
              aria-label="Clear workflow filter"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 p-6 pt-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRuns} />
      ) : runs.length === 0 ? (
        <ListEmptyMessage
          icon={HistoryIcon}
          message={
            debouncedSearch || statusFilter !== "all" || workflowFilter
              ? "No executions match your filters."
              : "No executions yet. Enable a workflow and it will run when its trigger fires."
          }
        />
      ) : (
        <div className="animate-in fade-in-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 duration-300">
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4 text-xs">Workflow</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Started</TableHead>
                  <TableHead className="text-xs">Run Time</TableHead>
                  <TableHead className="pr-4 text-xs">Exec. ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const failed = run.status === "failed" || run.status === "rejected"
                  const context = runContext(run)
                  return (
                    <TableRow
                      key={run._id}
                      className={cn(
                        "cursor-pointer",
                        failed && "bg-destructive/5 hover:bg-destructive/10"
                      )}
                      onClick={() => setSelectedRun(run)}
                    >
                      <TableCell className="max-w-72 py-3 pl-4">
                        <p className="truncate text-[13px] font-medium">
                          {run.workflowId?.name ?? "Deleted workflow"}
                        </p>
                        {context && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {context}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <RunStatusCell status={run.status} />
                      </TableCell>
                      <TableCell className="py-3 text-[13px] tabular-nums text-muted-foreground">
                        {startedAtFormatter.format(new Date(run.startedAt))}
                      </TableCell>
                      <TableCell className="py-3 text-[13px] tabular-nums text-muted-foreground">
                        {formatDuration(run.startedAt, run.finishedAt) ?? "—"}
                      </TableCell>
                      <TableCell
                        className="py-3 pr-4 font-mono text-xs text-muted-foreground"
                        title={run._id}
                      >
                        #{run._id.slice(-6)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        disabled={loading}
      />

      <RunDetailSheet run={selectedRun} onClose={() => setSelectedRun(null)} />
    </>
  )
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("workflows")
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runsWorkflowFilter, setRunsWorkflowFilter] = useState<WorkflowRecord | null>(null)

  const fetchWorkflows = useCallback(async () => {
    setError(null)
    try {
      const data = await listWorkflows()
      setWorkflows(data.workflows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows")
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workflow")
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update workflow")
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete workflow")
    } finally {
      setDeletingId(null)
    }
  }

  const showRunsFor = (workflow: WorkflowRecord) => {
    setRunsWorkflowFilter(workflow)
    setTab("executions")
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
                Automations that react to RFQ, order, and form events.
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

        <div className="border-b px-6 py-2.5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="workflows">
                <WorkflowIcon />
                Workflows
              </TabsTrigger>
              <TabsTrigger value="executions">
                <HistoryIcon />
                Executions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {tab === "workflows" ? (
            <WorkflowsTab
              workflows={workflows}
              loading={loading}
              error={error}
              creating={creating}
              onRetry={() => {
                setRefreshing(true)
                fetchWorkflows()
              }}
              onCreate={handleCreate}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onShowRuns={showRunsFor}
              togglingId={togglingId}
              deletingId={deletingId}
            />
          ) : (
            <ExecutionsTab
              workflowFilter={runsWorkflowFilter}
              onClearWorkflowFilter={() => setRunsWorkflowFilter(null)}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
