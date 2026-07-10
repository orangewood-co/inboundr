import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ServiceDetailPage from "@/pages/service-detail-page"

export const Route = createFileRoute("/service_/$requestId")({
  beforeLoad: () =>
    requireFeatureAndModuleAccess("service_management", "service_management"),
  component: ServiceDetailPage,
})
