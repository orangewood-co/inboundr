import { queryOptions } from "@tanstack/react-query"

import { API_ORIGIN } from "@/lib/env"
import { queryClient } from "@/lib/query-client"

export type WhatsAppNumberPurpose = "primary" | "rfq"

export const WHATSAPP_SETTINGS_URL = `${API_ORIGIN}/api/v1/organization/whatsapp`

export function whatsAppSettingsUrl(purpose: WhatsAppNumberPurpose) {
  return purpose === "rfq" ? `${WHATSAPP_SETTINGS_URL}/rfq` : WHATSAPP_SETTINGS_URL
}

/** One of the organization's WhatsApp connections (Settings → Integrations). */
export function whatsAppSettingsQueryOptionsFor(purpose: WhatsAppNumberPurpose) {
  return queryOptions({
    queryKey: ["organization", "whatsapp-settings", purpose],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async (): Promise<Record<string, any>> => {
      const response = await fetch(whatsAppSettingsUrl(purpose), { credentials: "include" })
      const data = await response.json().catch(() => null)
      if (!response.ok || data == null) throw new Error(data?.error ?? "Failed to load WhatsApp settings")
      return data
    },
    staleTime: 60_000,
  })
}

export const whatsAppSettingsQueryOptions = whatsAppSettingsQueryOptionsFor("primary")

export function invalidateWhatsAppSettings() {
  return queryClient.invalidateQueries({ queryKey: ["organization", "whatsapp-settings"] })
}
