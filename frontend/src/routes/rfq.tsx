import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAccess } from "@/lib/auth-guards"
import DashboardPage from "@/pages/dashboard-page"

export const Route = createFileRoute("/rfq")({
  beforeLoad: () => requireFeatureAccess("rfq"),
  component: DashboardPage,
})
