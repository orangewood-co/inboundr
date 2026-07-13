import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  HistoryIcon,
  RefreshCwIcon,
  ScaleIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  recruitmentApi,
  type RankingBatch,
  type RecruitmentRubric,
  type RecruitmentRubricCriterion,
} from "@/lib/recruitment"

type ConfirmAction = "approve" | "regenerate" | "rerank" | null

function statusTone(status: RecruitmentRubric["status"]) {
  if (status === "approved") return "default"
  return status === "draft" ? "secondary" : "outline"
}

export function RubricWorkflow({ jobId, className = "", canManage = false }: { jobId: string; className?: string; canManage?: boolean }) {
  const [rubrics, setRubrics] = useState<Awaited<ReturnType<typeof recruitmentApi.rubrics>> | null>(null)
  const [draft, setDraft] = useState<RecruitmentRubric | null>(null)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [enqueueOnApprove, setEnqueueOnApprove] = useState(true)
  const [batch, setBatch] = useState<RankingBatch | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await recruitmentApi.rubrics(jobId)
      setRubrics(result)
      setDraft(result.draft)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load ranking rubric")
    }
  }, [jobId])

  useEffect(() => {
    // Initial remote hydration is intentionally effect-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const batchActive = Boolean(batch?.batchId && (batch.completed ?? 0) < batch.total)
  useEffect(() => {
    if (!batch?.batchId || !batchActive) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let attempt = 0
    const poll = async () => {
      try {
        const next = await recruitmentApi.rankingBatch(batch.batchId)
        if (cancelled) return
        setBatch(next)
        attempt = 0
        if ((next.completed ?? 0) < next.total) timer = setTimeout(poll, 2500)
      } catch {
        if (cancelled) return
        attempt += 1
        timer = setTimeout(poll, Math.min(15000, 2500 * 2 ** attempt))
      }
    }
    timer = setTimeout(poll, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [batch?.batchId, batchActive])

  const weightTotal = useMemo(
    () => draft?.criteria.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0) ?? 0,
    [draft]
  )

  function updateCriterion(index: number, update: Partial<RecruitmentRubricCriterion>) {
    setDraft((current) =>
      current
        ? { ...current, criteria: current.criteria.map((criterion, itemIndex) => itemIndex === index ? { ...criterion, ...update } : criterion) }
        : current
    )
  }

  async function generate(regenerate = false) {
    setBusy(regenerate ? "regenerate" : "generate")
    try {
      const result = regenerate
        ? await recruitmentApi.regenerateRubric(jobId)
        : await recruitmentApi.generateRubric(jobId)
      setDraft(result.rubric)
      await load()
      toast.success(regenerate ? "New rubric draft generated" : "Rubric draft generated")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to generate rubric")
    } finally {
      setBusy("")
      setConfirmAction(null)
    }
  }

  async function saveDraft() {
    if (!draft) return
    if (Math.abs(weightTotal - 100) > 0.01) {
      toast.error("Criterion weights must total 100")
      return
    }
    if (draft.criteria.some((criterion) => !criterion.name.trim() || !criterion.description.trim())) {
      toast.error("Every criterion needs a name and description")
      return
    }
    setBusy("save")
    try {
      const { rubric } = await recruitmentApi.updateRubric(jobId, draft._id, {
        criteria: draft.criteria.map((criterion) => ({
          ...criterion,
          name: criterion.name.trim(),
          description: criterion.description.trim(),
        })),
        instructions: draft.instructions.trim(),
      })
      setDraft(rubric)
      await load()
      toast.success("Rubric draft saved")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save rubric")
    } finally {
      setBusy("")
    }
  }

  async function approve() {
    if (!draft) return
    if (Math.abs(weightTotal - 100) > 0.01) {
      toast.error("Criterion weights must total 100")
      return
    }
    if (draft.criteria.some((criterion) => !criterion.name.trim() || !criterion.description.trim())) {
      toast.error("Every criterion needs a name and description")
      return
    }
    setBusy("approve")
    try {
      const { rubric } = await recruitmentApi.updateRubric(jobId, draft._id, {
        criteria: draft.criteria.map((criterion) => ({
          ...criterion,
          name: criterion.name.trim(),
          description: criterion.description.trim(),
        })),
        instructions: draft.instructions.trim(),
      })
      const result = await recruitmentApi.approveRubric(jobId, rubric._id, enqueueOnApprove)
      if (result.batch) setBatch(result.batch)
      await load()
      toast.success("Rubric approved and frozen")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to approve rubric")
    } finally {
      setBusy("")
      setConfirmAction(null)
    }
  }

  async function rerankAll() {
    setBusy("rerank")
    try {
      const next = await recruitmentApi.rerankAll(jobId)
      setBatch(next)
      toast.success(next.total ? `${next.queued ?? next.total} applications queued` : "No active applications to rank")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to queue reranking")
    } finally {
      setBusy("")
      setConfirmAction(null)
    }
  }

  const completed = batch?.completed ?? 0
  const progress = batch?.total ? Math.min(100, Math.round(completed / batch.total * 100)) : 0

  return (
    <section className={`overflow-hidden rounded-2xl border bg-card shadow-xs ${className}`}>
      <div className="flex flex-col gap-4 border-b bg-muted/25 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <ScaleIcon className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">AI ranking rubric</h2>
              {rubrics?.approved && <Badge variant="outline">Approved v{rubrics.approved.version}</Badge>}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Generate criteria from the saved job description, then review and freeze them before any candidate is scored.
            </p>
          </div>
        </div>
        {rubrics?.approved && canManage && (
          <Button variant="outline" size="sm" onClick={() => setConfirmAction("rerank")} disabled={Boolean(busy) || batchActive}>
            <RefreshCwIcon /> Rerank all
          </Button>
        )}
      </div>

      {!canManage && <div className="border-b bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:px-6">Read-only: organization admin access is required to generate, edit, approve, or rerank with rubrics.</div>}

      {error ? (
        <div className="p-6 text-sm text-destructive">
          {error} <Button variant="link" size="sm" onClick={() => void load()}>Try again</Button>
        </div>
      ) : !rubrics ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Loading rubric…</div>
      ) : !draft ? (
        <div className="p-6">
          <div className="rounded-xl border border-dashed p-6 text-center">
            <SparklesIcon className="mx-auto size-6 text-muted-foreground" />
            <h3 className="mt-3 font-medium">{rubrics.approved ? "Create a new rubric version" : "Start with a structured draft"}</h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              AI proposes job-related criteria only. A human must inspect and approve the draft before ranking can use it.
            </p>
            {canManage && <Button className="mt-4" onClick={() => rubrics.items.length ? setConfirmAction("regenerate") : void generate()} disabled={Boolean(busy)}>
              {busy === "generate" ? <Spinner /> : <SparklesIcon />}
              {rubrics.items.length ? "Generate new version" : "Generate from description"}
            </Button>}
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">Draft v{draft.version}</Badge>
              <span>Model {draft.modelName}</span>
              <span aria-hidden="true">·</span>
              <span>Prompt {draft.promptVersion}</span>
            </div>
            <div className={`text-sm font-medium ${Math.abs(weightTotal - 100) < 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              Total weight {weightTotal}%
            </div>
          </div>
          <fieldset disabled={!canManage} className="space-y-3">
            {draft.criteria.map((criterion, index) => (
              <article key={criterion.id} className="rounded-xl border p-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                  <div>
                    <Label htmlFor={`criterion-${criterion.id}`}>Criterion {index + 1}</Label>
                    <Input
                      id={`criterion-${criterion.id}`}
                      className="mt-2"
                      value={criterion.name}
                      onChange={(event) => updateCriterion(index, { name: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`weight-${criterion.id}`}>Weight %</Label>
                    <Input
                      id={`weight-${criterion.id}`}
                      className="mt-2"
                      type="number"
                      min={0}
                      max={100}
                      value={criterion.weight}
                      onChange={(event) => updateCriterion(index, { weight: event.target.valueAsNumber || 0 })}
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
                    <Switch checked={criterion.required} onCheckedChange={(required) => updateCriterion(index, { required })} />
                    Must-have
                  </label>
                </div>
                <Label htmlFor={`description-${criterion.id}`} className="sr-only">Criterion description</Label>
                <textarea
                  id={`description-${criterion.id}`}
                  className="mt-3 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={criterion.description}
                  onChange={(event) => updateCriterion(index, { description: event.target.value })}
                  placeholder="Describe the evidence reviewers should look for."
                />
              </article>
            ))}
          </fieldset>
          <div className="mt-4">
            <Label htmlFor={`rubric-instructions-${jobId}`}>Reviewer instructions</Label>
            <textarea
              id={`rubric-instructions-${jobId}`}
              className="mt-2 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={draft.instructions}
              onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
              disabled={!canManage}
              placeholder="Optional job-specific scoring guidance."
            />
          </div>
          {canManage && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setConfirmAction("regenerate")} disabled={Boolean(busy)}>
              <RefreshCwIcon /> Regenerate
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void saveDraft()} disabled={Boolean(busy)}>
                {busy === "save" && <Spinner />} Save draft
              </Button>
              <Button onClick={() => setConfirmAction("approve")} disabled={Boolean(busy) || Math.abs(weightTotal - 100) > 0.01}>
                <CheckCircle2Icon /> Approve & freeze
              </Button>
            </div>
          </div>}
        </div>
      )}

      {batch && batch.total > 0 && (
        <div className="border-t bg-muted/20 px-5 py-4 sm:px-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{batchActive ? "Reranking applications" : "Reranking complete"}</span>
            <span className="text-muted-foreground">{completed}/{batch.total}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Reranking progress" aria-valuemin={0} aria-valuemax={batch.total} aria-valuenow={completed}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          {batch.byStatus && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(batch.byStatus).map(([status, count]) => <span key={status} className="capitalize">{status.replace("_", " ")}: {count}</span>)}
            </div>
          )}
        </div>
      )}

      {!!rubrics?.items.length && (
        <details className="border-t px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <HistoryIcon className="size-4" /> Version history <Badge variant="secondary">{rubrics.items.length}</Badge>
          </summary>
          <div className="mt-3 divide-y rounded-xl border">
            {rubrics.items.map((rubric) => (
              <div key={rubric._id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="font-medium">Version {rubric.version}</span>
                <Badge variant={statusTone(rubric.status)} className="capitalize">{rubric.status}</Badge>
                <span className="text-xs text-muted-foreground">{rubric.modelName} · {rubric.promptVersion}</span>
                <span className="ml-auto text-xs text-muted-foreground">{rubric.criteria.length} criteria</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && !busy && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction === "approve" ? <CheckCircle2Icon /> : <AlertTriangleIcon className="text-amber-600" />}
              {confirmAction === "approve" ? "Approve and freeze this rubric?" : confirmAction === "rerank" ? "Rerank every active application?" : "Generate a replacement draft?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "approve"
                ? "Approval makes this version immutable and the source of truth for future rankings. Review every criterion and weight first."
                : confirmAction === "rerank"
                  ? "This queues fresh advisory scores using the currently approved rubric. Existing results remain visible until processing completes."
                  : "The current draft will be superseded. The approved rubric remains active until you inspect and approve the new version."}
            </DialogDescription>
          </DialogHeader>
          {confirmAction === "approve" && (
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <span>
                <span className="block font-medium">Rerank active applications</span>
                <span className="mt-1 block text-xs text-muted-foreground">Queue a batch immediately after approval.</span>
              </span>
              <Switch checked={enqueueOnApprove} onCheckedChange={setEnqueueOnApprove} />
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === "approve" ? "default" : "destructive"}
              disabled={Boolean(busy)}
              onClick={() => confirmAction === "approve" ? void approve() : confirmAction === "rerank" ? void rerankAll() : void generate(true)}
            >
              {busy && <Spinner />}
              {confirmAction === "approve" ? "Approve & freeze" : confirmAction === "rerank" ? "Queue reranking" : "Regenerate draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
