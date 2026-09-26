import { queryOptions } from "@tanstack/react-query"

import { API_ORIGIN } from "@/lib/env"
import { queryClient } from "@/lib/query-client"

const PROCUREMENT_API_BASE = `${API_ORIGIN}/api/v1/procurement`
const ACTIVE_POLL_MS = 2_500

export type ProcurementRunStatus = "queued" | "processing" | "succeeded" | "failed"
export type ProcurementCheckDecision = "proceed" | "needs_clarification" | "out_of_scope"

export interface ProcurementSupplier {
  id: string
  name: string
  businessType: "manufacturer" | "distributor" | "trader" | "retailer"
  city: string
  state: string
  gstNumber: string | null
  gstVerified: boolean
  verifiedSupplier: boolean
  yearsInBusiness: number | null
  responseRate: number | null
  rating: number | null
}

export interface ProcurementListing {
  listingId: string
  provider: string
  supplier: ProcurementSupplier
  title: string
  brand: string | null
  modelNumber: string | null
  description: string | null
  specifications: Record<string, string>
  price: number | null
  priceUnit: string | null
  unitsPerPriceUnit: number | null
  minOrderQuantity: number | null
  minOrderUnit: string | null
  leadTimeDays: number | null
  url: string | null
}

export interface ProcurementCandidate {
  id: string
  rank: number
  listing: ProcurementListing
  unitPrice: number | null
  score: number
  scoreBreakdown: { specMatch: number; price: number; location: number; trust: number }
  reasons: string[]
  warnings: string[]
}

export interface ProcurementRun {
  id: string
  rfqId: string
  searchResultIndex: number
  lineIndex: number
  status: ProcurementRunStatus
  requirement: {
    name: string
    quantity: number
    code: string | null
    manufacturer: string | null
    specifications: Record<string, string>
    notes: string | null
  }
  searchAnyway: boolean
  provider: string
  check: {
    decision: ProcurementCheckDecision
    reason: string
    productType: string | null
    missingInformation: string[]
    searchQueries: string[]
    mustHave: string[]
    niceToHave: string[]
  } | null
  candidates: ProcurementCandidate[]
  summary: {
    listingsFound: number
    uniqueSuppliers: number
    filteredOut: Array<{ reason: string; count: number }>
  } | null
  queries: Array<{ query: string; resultCount: number; fromCache: boolean }>
  selectedCandidateId: string | null
  selectedAt: string | null
  error: string | null
  attempts: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface ProcurementSettings {
  instructions: string
  preferredStates: string[]
  excludedKeywords: string[]
  requireGstRegistered: boolean
  requireVerifiedSupplier: boolean
  defaultMarginPercent: number
  updatedAt?: string
}

async function procurementRequest<T>(path: string, failureMessage: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PROCUREMENT_API_BASE}/${path}`, {
    credentials: "include",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  })
  const data = await response.json().catch(() => null)
  // data is null when the body isn't valid JSON, even on a 2xx response.
  if (!response.ok || data == null) throw new Error(data?.error ?? failureMessage)
  return data as T
}

export function isActiveProcurementRun(run: Pick<ProcurementRun, "status"> | null | undefined): boolean {
  return run?.status === "queued" || run?.status === "processing"
}

export const procurementRunsQueryKey = (rfqId: string) => ["procurement", "rfq", rfqId, "runs"] as const

export const procurementRunsQueryOptions = (rfqId: string) =>
  queryOptions({
    queryKey: procurementRunsQueryKey(rfqId),
    queryFn: async () => {
      const data = await procurementRequest<{ runs: ProcurementRun[] }>(
        `rfqs/${rfqId}/runs`,
        "Failed to load supplier searches",
      )
      return data.runs
    },
    refetchInterval: (query) => (query.state.data?.some(isActiveProcurementRun) ? ACTIVE_POLL_MS : false),
    staleTime: 10_000,
  })

export const procurementSettingsQueryOptions = queryOptions({
  queryKey: ["procurement", "settings"],
  queryFn: async () => {
    const data = await procurementRequest<{ settings: ProcurementSettings }>(
      "settings",
      "Failed to load sourcing preferences",
    )
    return data.settings
  },
  staleTime: 5 * 60_000,
})

function upsertRunInCache(run: ProcurementRun) {
  queryClient.setQueryData<ProcurementRun[]>(procurementRunsQueryKey(run.rfqId), (current) => [
    ...(current ?? []).filter((item) => item.lineIndex !== run.lineIndex),
    run,
  ])
}

export async function startProcurementRun(
  rfqId: string,
  body: { searchResultIndex: number; force?: boolean; notes?: string; searchAnyway?: boolean },
): Promise<ProcurementRun> {
  const data = await procurementRequest<{ run: ProcurementRun }>(
    `rfqs/${rfqId}/runs`,
    "Failed to start supplier search",
    { method: "POST", body: JSON.stringify(body) },
  )
  upsertRunInCache(data.run)
  return data.run
}

export async function selectProcurementCandidate(run: ProcurementRun, candidateId: string): Promise<ProcurementRun> {
  const data = await procurementRequest<{ run: ProcurementRun }>(
    `runs/${run.id}/select`,
    "Failed to record the selected supplier",
    { method: "POST", body: JSON.stringify({ candidateId }) },
  )
  upsertRunInCache({ ...data.run, lineIndex: run.lineIndex })
  return data.run
}

export async function saveProcurementSettings(settings: Partial<ProcurementSettings>): Promise<ProcurementSettings> {
  const data = await procurementRequest<{ settings: ProcurementSettings }>(
    "settings",
    "Failed to save sourcing preferences",
    { method: "PUT", body: JSON.stringify(settings) },
  )
  queryClient.setQueryData(procurementSettingsQueryOptions.queryKey, data.settings)
  return data.settings
}
