import { queryOptions } from "@tanstack/react-query"

import { API_ORIGIN } from "@/lib/env"
import { queryClient } from "@/lib/query-client"

async function fetchSupportResource(path: string, failureMessage: string) {
  const response = await fetch(`${API_ORIGIN}/api/v1/support/${path}`, {
    credentials: "include",
  })
  const data = await response.json().catch(() => null)
  // data is null when the body isn't valid JSON, even on a 2xx response.
  if (!response.ok || data == null) throw new Error(data?.error ?? failureMessage)
  return data
}

export const supportTagsQueryOptions = queryOptions({
  queryKey: ["support", "ticket-tags"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: async (): Promise<{ tags?: any[] }> =>
    fetchSupportResource("ticket-tags", "Failed to load ticket tags"),
  staleTime: 5 * 60_000,
})

export const supportResolutionReasonsQueryOptions = queryOptions({
  queryKey: ["support", "resolution-reasons"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: async (): Promise<{ reasons?: any[] }> =>
    fetchSupportResource("resolution-reasons", "Failed to load resolution reasons"),
  staleTime: 5 * 60_000,
})

export const supportTemplatesQueryOptions = queryOptions({
  queryKey: ["support", "templates"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: async (): Promise<{ templates?: any[] }> =>
    fetchSupportResource("templates", "Failed to load templates"),
  staleTime: 5 * 60_000,
})

export const supportCallSettingsQueryOptions = queryOptions({
  queryKey: ["support", "call-settings"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: async (): Promise<Record<string, any>> =>
    fetchSupportResource("call/settings", "Failed to load call settings"),
  staleTime: 5 * 60_000,
})

export function invalidateSupportTags() {
  return queryClient.invalidateQueries({ queryKey: supportTagsQueryOptions.queryKey })
}

export function invalidateSupportResolutionReasons() {
  return queryClient.invalidateQueries({ queryKey: supportResolutionReasonsQueryOptions.queryKey })
}

export function invalidateSupportTemplates() {
  return queryClient.invalidateQueries({ queryKey: supportTemplatesQueryOptions.queryKey })
}

export function invalidateSupportCallSettings() {
  return queryClient.invalidateQueries({ queryKey: supportCallSettingsQueryOptions.queryKey })
}
