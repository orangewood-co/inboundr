import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmailsPage, { EMAIL_LIST_FILTERS, type EmailListFilter } from "@/pages/emails-page"

type EmailsRouteSearch = {
  email?: string
  q?: string
  /** Classification chip; absent means every conversation. */
  filter?: EmailListFilter
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

export const Route = createFileRoute("/emails")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  validateSearch: (search: Record<string, unknown>): EmailsRouteSearch => ({
    email: optionalString(search.email),
    q: optionalString(search.q),
    filter: EMAIL_LIST_FILTERS.includes(search.filter as EmailListFilter)
      ? (search.filter as EmailListFilter)
      : undefined,
  }),
  component: EmailsPage,
})
