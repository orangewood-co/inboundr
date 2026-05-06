import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import DashboardPage from "@/pages/dashboard-page"

export const Route = createFileRoute("/")({
  beforeLoad: requireSession,
  component: DashboardPage,
})
