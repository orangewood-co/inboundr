import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import DashboardPage from "@/pages/dashboard-page"

export const Route = createFileRoute("/rfq")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  component: DashboardPage,
})
