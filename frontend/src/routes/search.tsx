import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import SearchPage from "@/pages/search-page"

type SearchRouteParams = {
  q?: string
}

export const Route = createFileRoute("/search")({
  beforeLoad: requireSession,
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
})
