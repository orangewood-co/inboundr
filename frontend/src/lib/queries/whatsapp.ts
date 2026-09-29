import { queryOptions } from "@tanstack/react-query"

import { API_ORIGIN } from "@/lib/env"
import { queryClient } from "@/lib/query-client"

export const WHATSAPP_SETTINGS_URL = `${API_ORIGIN}/api/v1/organization/whatsapp`

/** Organization-level WhatsApp connection (Settings → Integrations). */
export const whatsAppSettingsQueryOptions = queryOptions({
  queryKey: ["organization", "whatsapp-settings"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: async (): Promise<Record<string, any>> => {
    const response = await fetch(WHATSAPP_SETTINGS_URL, { credentials: "include" })
    const data = await response.json().catch(() => null)
    if (!response.ok || data == null) throw new Error(data?.error ?? "Failed to load WhatsApp settings")
    return data
  },
  staleTime: 60_000,
})

export function invalidateWhatsAppSettings() {
  return queryClient.invalidateQueries({ queryKey: whatsAppSettingsQueryOptions.queryKey })
}
