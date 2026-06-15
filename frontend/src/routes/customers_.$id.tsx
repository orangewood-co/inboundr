import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import CustomerDetailPage from "@/pages/customer-detail-page"

export const Route = createFileRoute("/customers_/$id")({
  beforeLoad: () => requireFeatureAndModuleAccess("customers", "customers"),
  component: CustomerDetailPage,
})
