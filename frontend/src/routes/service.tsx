import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ServiceRequestsPage from "@/pages/service-requests-page"

export const Route = createFileRoute("/service")({
  beforeLoad: () =>
    requireFeatureAndModuleAccess("service_management", "service_management"),
  component: ServiceRequestsPage,
})
