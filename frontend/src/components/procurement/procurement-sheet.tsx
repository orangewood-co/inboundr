import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  MapPinIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldCheckIcon,
  StarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useEntitlements } from "@/lib/entitlements"
import { formatListTimestamp, formatMoney } from "@/lib/format"
import {
  isActiveProcurementRun,
  procurementRunsQueryOptions,
  procurementSettingsQueryOptions,
  startProcurementRun,
  type ProcurementCandidate,
  type ProcurementRun,
} from "@/lib/queries/procurement"
import { SourcingPreferencesDialog } from "@/components/procurement/sourcing-preferences-dialog"
import { UseSupplierDialog, type ProcuredQuoteLine } from "@/components/procurement/use-supplier-dialog"

export type { ProcuredQuoteLine }

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function RequirementChips({ run, query }: { run: ProcurementRun | null; query: { name: string; quantity: number } }) {
  const requirement = run?.requirement
  const chips = [
    requirement?.manufacturer ? `Brand: ${requirement.manufacturer}` : null,
    requirement?.code ? `Code: ${requirement.code}` : null,
    ...Object.entries(requirement?.specifications ?? {}).map(([key, value]) => `${key}: ${value}`),
  ].filter((chip): chip is string => Boolean(chip))
  const mustHave = run?.check?.mustHave ?? []

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{query.name}</p>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          Qty: {query.quantity}
        </span>
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip} className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {chip}
            </span>
          ))}
        </div>
      )}
      {requirement?.notes && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Your notes:</span> {requirement.notes}
        </p>
      )}
      {mustHave.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Must match:</span> {mustHave.join(", ")}
        </p>
      )}
    </div>
  )
}

function CandidateCard({
  candidate,
  selected,
  onUse,
}: {
  candidate: ProcurementCandidate
  selected: boolean
  onUse: () => void
}) {
  const { listing } = candidate
  const { supplier } = listing
  const packPricing = listing.price != null && listing.priceUnit && listing.unitsPerPriceUnit !== 1

  return (
    <div
      className={`rounded-lg border ${
        selected ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : candidate.rank === 1 ? "border-primary/20" : ""
      }`}
    >
      <div className="flex gap-3 px-3 pt-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
          {candidate.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{supplier.name}</p>
            {selected && <StatusBadge tone="success">Selected</StatusBadge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3" />
              {supplier.city}, {supplier.state}
            </span>
            <span className="capitalize">· {supplier.businessType}</span>
            {supplier.yearsInBusiness != null && <span>· {supplier.yearsInBusiness} yrs</span>}
            {supplier.rating != null && (
              <span className="inline-flex items-center gap-0.5">
                · <StarIcon className="size-3 fill-current" /> {supplier.rating.toFixed(1)}
              </span>
            )}
            {supplier.responseRate != null && <span>· Responds {percent(supplier.responseRate)}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {supplier.gstVerified && (
              <StatusBadge tone="success" icon={ShieldCheckIcon}>
                GST verified
              </StatusBadge>
            )}
            {supplier.verifiedSupplier && (
              <StatusBadge tone="info" icon={BadgeCheckIcon}>
                Verified supplier
              </StatusBadge>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {candidate.unitPrice != null ? (
            <>
              <p className="text-sm font-bold tabular-nums">{formatMoney(candidate.unitPrice)}</p>
              <p className="text-[10px] text-muted-foreground">per unit</p>
            </>
          ) : listing.price != null ? (
            <p className="text-sm font-bold tabular-nums">{formatMoney(listing.price)}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Price on request</p>
          )}
          {packPricing && (
            <p className="text-[10px] text-muted-foreground">
              {formatMoney(listing.price!)} per {listing.priceUnit}
            </p>
          )}
        </div>
      </div>

      <div className="mx-3 mt-2.5 rounded-md bg-muted/30 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium leading-snug">{listing.title}</p>
          {listing.url && (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              View
              <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[
            listing.modelNumber ? `Model ${listing.modelNumber}` : null,
            listing.minOrderQuantity != null
              ? `Min. order ${listing.minOrderQuantity} ${(listing.minOrderUnit ?? "units").toLowerCase()}`
              : null,
            listing.leadTimeDays != null ? `Dispatch in ${listing.leadTimeDays} days` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {(candidate.reasons.length > 0 || candidate.warnings.length > 0) && (
        <ul className="mx-3 mt-2 space-y-0.5">
          {candidate.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-[11px]">
              <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" />
              <span>{reason}</span>
            </li>
          ))}
          {candidate.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5 text-[11px] text-warning">
              <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${candidate.score}%` }} />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">Score {candidate.score}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Spec match {percent(candidate.scoreBreakdown.specMatch)} · Price {percent(candidate.scoreBreakdown.price)} ·
            Location {percent(candidate.scoreBreakdown.location)} · Trust {percent(candidate.scoreBreakdown.trust)}
          </TooltipContent>
        </Tooltip>
        <Button size="sm" variant={candidate.rank === 1 ? "default" : "outline"} className="h-7 text-xs" onClick={onUse}>
          Use This Supplier
        </Button>
      </div>
    </div>
  )
}

function RunSummary({ run }: { run: ProcurementRun }) {
  const summary = run.summary
  if (!summary) return null
  const filtered = summary.filteredOut.reduce((total, item) => total + item.count, 0)

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground hover:text-foreground">
        <span>
          Found {summary.listingsFound} listings from {summary.uniqueSuppliers} suppliers
          {filtered > 0 ? `, ${filtered} set aside` : ""}. Showing the top {run.candidates.length}.
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-[11px]">
          {summary.filteredOut.length > 0 && (
            <div>
              <p className="font-medium">Set Aside</p>
              <ul className="mt-0.5 text-muted-foreground">
                {summary.filteredOut.map((item) => (
                  <li key={item.reason}>
                    {item.reason}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.queries.length > 0 && (
            <div>
              <p className="font-medium">Searches Run</p>
              <ul className="mt-0.5 text-muted-foreground">
                {run.queries.map((item) => (
                  <li key={item.query}>
                    “{item.query}” returned {item.resultCount}
                    {item.fromCache ? " (cached)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ProcurementSheet({
  open,
  onOpenChange,
  rfqId,
  lineIndex,
  query,
  onUseSupplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rfqId: string
  lineIndex: number | null
  query: { name: string; quantity: number } | null
  onUseSupplier: (lineIndex: number, line: ProcuredQuoteLine) => void
}) {
  const { canManageOrganization } = useEntitlements()
  const { data: runs, isPending: runsPending } = useQuery(procurementRunsQueryOptions(rfqId))
  const { data: settings } = useQuery(procurementSettingsQueryOptions)
  const [notes, setNotes] = useState("")
  const [starting, setStarting] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [activeCandidate, setActiveCandidate] = useState<ProcurementCandidate | null>(null)
  const [useSupplierOpen, setUseSupplierOpen] = useState(false)

  const run = lineIndex != null ? runs?.find((item) => item.lineIndex === lineIndex) ?? null : null
  const active = isActiveProcurementRun(run)
  const autoStartedFor = useRef<string | null>(null)

  // Opening the sheet is the user's "Procure" click, so a line with no search starts one right away.
  useEffect(() => {
    if (!open) {
      autoStartedFor.current = null
      return
    }
    if (lineIndex == null || runsPending || run) return
    const key = `${rfqId}:${lineIndex}`
    if (autoStartedFor.current === key) return
    autoStartedFor.current = key
    setStarting(true)
    startProcurementRun(rfqId, { searchResultIndex: lineIndex })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to start supplier search"))
      .finally(() => setStarting(false))
  }, [open, lineIndex, runsPending, run, rfqId])

  const search = async (options: { searchAnyway?: boolean } = {}) => {
    if (lineIndex == null) return
    setStarting(true)
    try {
      await startProcurementRun(rfqId, {
        searchResultIndex: lineIndex,
        force: true,
        notes: notes.trim() || run?.requirement.notes || undefined,
        searchAnyway: options.searchAnyway,
      })
      setNotes("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start supplier search")
    } finally {
      setStarting(false)
    }
  }

  const renderBody = () => {
    if (!query) return null

    if (runsPending || (!run && starting)) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )
    }

    if (!run) {
      return (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <SearchIcon className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No Supplier Search Yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check the requirement, search the directory, and rank suppliers for this item.
          </p>
          <Button size="sm" className="mt-4" onClick={() => search()} disabled={starting}>
            Find Suppliers
          </Button>
        </div>
      )
    }

    if (active) {
      return (
        <div className="rounded-lg border px-4 py-8 text-center">
          <Spinner className="mx-auto size-5" />
          <p className="mt-3 text-sm font-medium">
            {run.status === "queued" ? "Waiting to Start" : "Searching for Suppliers"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Checking the requirement, searching {run.provider}, and ranking what comes back. This usually takes 10 to 30
            seconds.
          </p>
          {run.attempts > 1 && run.error && (
            <p className="mt-2 text-[11px] text-warning">Retrying after an error: {run.error}</p>
          )}
        </div>
      )
    }

    if (run.status === "failed") {
      return (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-4">
          <p className="text-sm font-medium text-destructive">The Search Failed</p>
          <p className="mt-1 text-xs text-destructive/80">{run.error ?? "Something went wrong while searching."}</p>
        </div>
      )
    }

    const check = run.check
    if (check && check.decision !== "proceed") {
      const needsClarification = check.decision === "needs_clarification"
      return (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-4">
          <p className="text-sm font-medium">{needsClarification ? "More Detail Needed" : "Outside Your Sourcing Scope"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{check.reason}</p>
          {check.missingInformation.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
              {check.missingInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {needsClarification
              ? "Add the missing details below and search again, or search with what you have."
              : "If this is wrong, search anyway or update your sourcing preferences."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-7 text-xs"
            onClick={() => search({ searchAnyway: true })}
            disabled={starting}
          >
            Search Anyway
          </Button>
        </div>
      )
    }

    if (run.candidates.length === 0) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">No Suppliers Matched</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing passed the checks. Add detail below, or relax your sourcing preferences.
            </p>
          </div>
          <RunSummary run={run} />
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <RunSummary run={run} />
        {run.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={run.selectedCandidateId === candidate.id}
            onUse={() => {
              setActiveCandidate(candidate)
              setUseSupplierOpen(true)
            }}
          />
        ))}
      </div>
    )
  }

  const showRefine = run && !active && query

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-4 pr-12">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle>Find Suppliers</SheetTitle>
                <SheetDescription className="text-xs">
                  Ranked suppliers for an item that isn't in your catalogue.
                </SheetDescription>
              </div>
              {canManageOrganization && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={() => setPreferencesOpen(true)}>
                      <Settings2Icon />
                      <span className="sr-only">Sourcing preferences</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sourcing preferences</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {query && <RequirementChips run={run} query={query} />}
            {renderBody()}
          </div>

          {showRefine && (
            <div className="space-y-2 border-t px-5 py-3">
              <div className="flex items-center gap-2">
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add detail for the next search, e.g. 150mm, digital, Mitutoyo only"
                  className="h-8 text-xs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !starting) void search()
                  }}
                />
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => search()} disabled={starting}>
                  {starting ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon className="size-3.5" />}
                  Search Again
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {run.provider}
                {run.completedAt ? ` · Searched ${formatListTimestamp(run.completedAt)}` : ""}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {run && (
        <UseSupplierDialog
          open={useSupplierOpen}
          onOpenChange={setUseSupplierOpen}
          run={run}
          candidate={activeCandidate}
          defaultMarginPercent={settings?.defaultMarginPercent ?? 15}
          canSaveToCatalog={canManageOrganization}
          onConfirm={(line) => {
            if (lineIndex == null) return
            onUseSupplier(lineIndex, line)
            onOpenChange(false)
          }}
        />
      )}

      {canManageOrganization && <SourcingPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />}
    </>
  )
}
