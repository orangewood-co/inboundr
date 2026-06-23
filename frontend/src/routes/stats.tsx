import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import StatsPage from "@/pages/stats-page"

export const Route = createFileRoute("/stats")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  component: StatsPage,
})
