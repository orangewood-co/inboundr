import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import StatsPage from "@/pages/stats-page"

export const Route = createFileRoute("/stats")({
  beforeLoad: requireSession,
  component: StatsPage,
})
