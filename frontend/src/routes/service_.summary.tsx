import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ServiceSummaryPage from "@/pages/service-summary-page"

export const Route = createFileRoute("/service_/summary")({
  beforeLoad: () =>
    requireFeatureAndModuleAccess("service_management", "service_management"),
  component: ServiceSummaryPage,
})
