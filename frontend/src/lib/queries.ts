import { queryOptions, useQuery } from "@tanstack/react-query"

import { getSession } from "@/lib/auth-client"
import { API_ORIGIN } from "@/lib/env"
import {
  ACTIVE_ORGANIZATION_CHANGED_EVENT,
  getActiveOrganizationId,
  setActiveOrganizationId,
} from "@/lib/organization-context"
import { queryClient } from "@/lib/query-client"

/**
 * Response of GET /api/v1/organization/me. The organization document is large
 * and page-specific consumers read different slices of it, so it stays loosely
 * typed here; pages cast to their own richer interfaces where needed.
 */
export interface OrganizationMeResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization?: Record<string, any>
  entitlements?: {
    effectiveFeatures?: string[]
    planSlug?: string
  }
  employeeAccess?: {
    restricted?: boolean
    enabled?: boolean
    allowedModules?: string[]
    canManageOrganization?: boolean
  } | null
}

export const ORGANIZATION_ME_QUERY_KEY = ["organization", "me"] as const

// Tracks the org id from the most recent /me response so the
// active-organization-changed listener can tell a genuine org switch apart
// from the initial claim performed right below in the query function.
let lastLoadedOrganizationId: string | null = null

async function fetchOrganizationMe(): Promise<OrganizationMeResponse> {
  const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
    credentials: "include",
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || "Failed to load organization")
  }

  const organizationId = data?.organization?._id ? String(data.organization._id) : ""
  if (organizationId) {
    lastLoadedOrganizationId = organizationId
    // Ensure every subsequent API call carries x-organization-id (attached by
    // installOrganizationFetchContext) so the backend can skip its expensive
    // organization-resolution path.
    if (!getActiveOrganizationId()) {
      setActiveOrganizationId(organizationId)
    }
  }

  return data as OrganizationMeResponse
}

export const organizationMeQueryOptions = queryOptions({
  queryKey: ORGANIZATION_ME_QUERY_KEY,
  queryFn: fetchOrganizationMe,
  staleTime: 5 * 60_000,
})

export function useOrganizationMe() {
  return useQuery(organizationMeQueryOptions)
}

export function invalidateOrganizationMe() {
  return queryClient.invalidateQueries({ queryKey: ORGANIZATION_ME_QUERY_KEY })
}

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const { data } = await getSession()
    return data
  },
  staleTime: 60_000,
})

/**
 * Cross-cutting cache invalidation. Called once at startup from main.tsx.
 */
export function installQueryCacheListeners() {
  window.addEventListener(ACTIVE_ORGANIZATION_CHANGED_EVENT, (event) => {
    const organizationId = (event as CustomEvent<{ organizationId?: string }>).detail?.organizationId
    if (organizationId && organizationId !== lastLoadedOrganizationId) {
      // A genuine org switch changes the x-organization-id header on every
      // API call, so all cached data is potentially for the wrong org.
      void queryClient.invalidateQueries()
    }
  })
}

export * from "@/lib/queries/admin"
export * from "@/lib/queries/catalogs"
export * from "@/lib/queries/customer-fields"
export * from "@/lib/queries/gmail"
export * from "@/lib/queries/invoices"
export * from "@/lib/queries/organization-members"
export * from "@/lib/queries/support"
export * from "@/lib/queries/whatsapp"
