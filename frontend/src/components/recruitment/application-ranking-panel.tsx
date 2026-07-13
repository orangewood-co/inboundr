import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  recruitmentApi,
  type ApplicationRanking,
  type RankingStatus,
  type RecruitmentRubric,
} from "@/lib/recruitment"

const activeStatuses: RankingStatus[] = ["queued", "processing"]

const statusCopy: Record<RankingStatus, { label: string; description: string }> = {
  not_requested: { label: "Not ranked", description: "Queue an advisory ranking when an approved rubric is available." },
  queued: { label: "Queued", description: "Waiting for a ranking worker. This page will refresh automatically." },
  processing: { label: "Processing", description: "The application is being assessed against the frozen rubric." },
  succeeded: { label: "Completed", description: "Review the evidence and use your own judgment before taking action." },
  failed: { label: "Failed", description: "The ranking could not be completed. You can retry the failed job." },
  manual_review: { label: "Manual review", description: "Automation stopped because this application needs direct human review." },
}

function statusIcon(status: RankingStatus) {
  if (status === "succeeded") return <CheckCircle2Icon className="size-5 text-emerald-600 dark:text-emerald-400" />
  if (status === "failed" || status === "manual_review") return <AlertCircleIcon className="size-5 text-amber-600 dark:text-amber-400" />
  if (status === "queued" || status === "processing") return <Spinner className="size-5" />
  return <Clock3Icon className="size-5 text-muted-foreground" />
}

export function ApplicationRankingPanel({ applicationId, jobId, canManage = false }: { applicationId: string; jobId?: string; canManage?: boolean }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof recruitmentApi.applicationRanking>> | null>(null)
  const [rubrics, setRubrics] = useState<RecruitmentRubric[]>([])
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const [rankingState, rubricState] = await Promise.all([
        recruitmentApi.applicationRanking(applicationId),
        jobId ? recruitmentApi.rubrics(jobId).catch(() => null) : Promise.resolve(null),
      ])
      setState(rankingState)
      if (rubricState) setRubrics(rubricState.items)
      setError("")
      return rankingState
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load ranking")
      return null
    }
  }, [applicationId, jobId])

  useEffect(() => {
    // Initial remote hydration is intentionally effect-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const status = state?.ranking.status ?? "not_requested"
  const isActive = activeStatuses.includes(status)
  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let attempt = 0
    const poll = async () => {
      const next = await load()
      if (cancelled) return
      if (!next) attempt += 1
      else attempt = 0
      if (!next || activeStatuses.includes(next.ranking.status)) {
        timer = setTimeout(poll, Math.min(15000, 2500 * 2 ** attempt))
      }
    }
    timer = setTimeout(poll, 1800)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isActive, load])

  const ranking: ApplicationRanking = state?.ranking ?? { status: "not_requested" }
  const result = ranking.result
  const rubric = useMemo(
    () => rubrics.find((item) => item.version === (result?.rubricVersion ?? ranking.rubricVersion)),
    [ranking.rubricVersion, result?.rubricVersion, rubrics]
  )
  const criteriaById = useMemo(
    () => new Map(rubric?.criteria.map((criterion) => [criterion.id, criterion]) ?? []),
    [rubric]
  )

  async function queue(action: "retry" | "rerank") {
    setBusy(action)
    try {
      if (action === "retry") await recruitmentApi.retryApplicationRanking(applicationId)
      else await recruitmentApi.rerankApplication(applicationId)
      await load()
      toast.success(action === "retry" ? "Ranking retry queued" : "Fresh ranking queued")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to queue ranking")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-col gap-4 border-b bg-muted/25 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <SparklesIcon className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">AI-Assisted Ranking</h2>
              <Badge variant="outline" className="capitalize">{statusCopy[status].label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{statusCopy[status].description}</p>
          </div>
        </div>
        {!isActive && canManage && (
          <Button
            variant={status === "not_requested" ? "default" : "outline"}
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => void queue(status === "failed" || status === "manual_review" ? "retry" : "rerank")}
          >
            {busy ? <Spinner /> : <RefreshCwIcon />}
            {status === "failed" || status === "manual_review" ? "Retry Ranking" : result ? "Rerank" : "Queue Ranking"}
          </Button>
        )}
      </div>

      {!canManage && <div className="border-b bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:px-6">Read-only: organization admin access is required to queue, retry, or rerank applications.</div>}

      <div className="border-b border-amber-500/20 bg-amber-500/8 px-5 py-3 sm:px-6">
        <p className="flex items-start gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
          Advisory only — a human decision is required. Never advance or reject a candidate from this score alone.
        </p>
      </div>

      {error && !state ? (
        <div className="p-6 text-sm text-destructive">
          {error} <Button variant="link" size="sm" onClick={() => void load()}>Try Again</Button>
        </div>
      ) : !state ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Loading ranking…</div>
      ) : isActive ? (
        <div className="flex items-center gap-4 p-6" aria-live="polite">
          <div className="flex size-12 items-center justify-center rounded-full border bg-muted/30">{statusIcon(status)}</div>
          <div>
            <p className="font-medium">{statusCopy[status].label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ranking.rubricVersion ? `Rubric v${ranking.rubricVersion}` : "Preparing rubric context"}
              {ranking.retryAt ? ` · Next attempt ${new Date(ranking.retryAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
        </div>
      ) : result ? (
        <div className="p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
            <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted/25">
              <div className="text-center">
                <p className="text-4xl font-semibold tabular-nums">{Math.round(result.overallScore)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Overall / 100</p>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Confidence {Math.round(result.confidence * 100)}%</Badge>
                <Badge variant="outline">Rubric v{result.rubricVersion}</Badge>
                <Badge variant="outline">{result.model}</Badge>
                <Badge variant="outline">{result.promptVersion}</Badge>
              </div>
              <h3 className="mt-4 text-sm font-semibold">Assessment Rationale</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{result.rationale}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">Weighted Criterion Breakdown</h3>
            {result.criterionScores.map((item) => {
              const criterion = criteriaById.get(item.criterionId)
              return (
                <article key={item.criterionId} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{criterion?.name ?? item.criterionId.replaceAll("-", " ")}</h4>
                        {criterion?.required && <Badge variant="outline">Must-have</Badge>}
                      </div>
                      {criterion?.description && <p className="mt-1 text-xs text-muted-foreground">{criterion.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums">{Math.round(item.score)}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
                      <p className="text-xs text-muted-foreground">{item.weight}% weight</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.rationale}</p>
                  {!!item.evidence.length && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evidence excerpts</p>
                      {item.evidence.map((excerpt, index) => (
                        <blockquote key={`${item.criterionId}-${index}`} className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                          “{excerpt}”
                        </blockquote>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {!!result.missingRequirements.length && (
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
              <h3 className="flex items-center gap-2 font-semibold"><AlertCircleIcon className="size-4 text-amber-600" /> Missing or Unverified Requirements</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {result.missingRequirements.map((requirement, index) => <li key={index}>• {requirement}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-start gap-4 rounded-xl border border-dashed p-5">
            <div className="mt-0.5">{statusIcon(status)}</div>
            <div>
              <h3 className="font-medium">{statusCopy[status].label}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{ranking.error || statusCopy[status].description}</p>
              {ranking.rubricVersion && <p className="mt-2 text-xs text-muted-foreground">Rubric version {ranking.rubricVersion}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
