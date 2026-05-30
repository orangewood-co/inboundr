import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import CustomerDetailPage from "@/pages/customer-detail-page"

export const Route = createFileRoute("/customers_/$id")({
  beforeLoad: () => requireModuleAccess("customers"),
  component: CustomerDetailPage,
})
