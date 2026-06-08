import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import DashboardPage from "@/pages/dashboard-page"

type RFQRouteSearch = {
  rfq?: string
}

export const Route = createFileRoute("/rfq")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  validateSearch: (search: Record<string, unknown>): RFQRouteSearch => ({
    rfq: typeof search.rfq === "string" && search.rfq.trim() ? search.rfq : undefined,
  }),
  component: DashboardPage,
})
