import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ServiceNewPage from "@/pages/service-new-page"

export const Route = createFileRoute("/service_/new")({
  beforeLoad: () =>
    requireFeatureAndModuleAccess("service_management", "service_management"),
  component: ServiceNewPage,
})
