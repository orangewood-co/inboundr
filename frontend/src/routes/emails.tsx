import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmailsPage, {
  EMAIL_LIST_FILTERS,
  INBOX_CHANNEL_FILTERS,
  type EmailListFilter,
  type InboxChannelFilter,
} from "@/pages/emails-page"

type EmailsRouteSearch = {
  email?: string
  /** Selected WhatsApp chat; mutually exclusive with `email`. */
  conversation?: string
  q?: string
  /** Classification chip; absent means every conversation. */
  filter?: EmailListFilter
  /** Channel filter; absent means every channel. */
  channel?: InboxChannelFilter
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

export const Route = createFileRoute("/emails")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  validateSearch: (search: Record<string, unknown>): EmailsRouteSearch => ({
    email: optionalString(search.email),
    conversation: optionalString(search.conversation),
    q: optionalString(search.q),
    filter: EMAIL_LIST_FILTERS.includes(search.filter as EmailListFilter)
      ? (search.filter as EmailListFilter)
      : undefined,
    channel: INBOX_CHANNEL_FILTERS.includes(search.channel as InboxChannelFilter)
      ? (search.channel as InboxChannelFilter)
      : undefined,
  }),
  component: EmailsPage,
})
