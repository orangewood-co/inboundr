import { createFileRoute } from "@tanstack/react-router"

import SupportListPage from "@/pages/support-list-page"
import type { TicketFilter } from "@/components/support/types"

const VALID_STATUSES: TicketFilter[] = ["open", "resolved", "all"]

export type SupportListSearch = {
  status: TicketFilter
  q: string
  page: number
}

export const Route = createFileRoute("/support/")({
  validateSearch: (search: Record<string, unknown>): SupportListSearch => {
    const status = String(search.status ?? "open") as TicketFilter
    const page = Number(search.page)
    return {
      status: VALID_STATUSES.includes(status) ? status : "open",
      q: typeof search.q === "string" ? search.q : "",
      page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
    }
  },
  component: SupportListPage,
})
