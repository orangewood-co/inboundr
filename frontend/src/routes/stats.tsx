import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import StatsPage from "@/pages/stats-page"

export const Route = createFileRoute("/stats")({
  beforeLoad: () => requireModuleAccess("stats"),
  component: StatsPage,
})
