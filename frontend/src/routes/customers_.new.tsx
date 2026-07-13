import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import CustomerNewPage from "@/pages/customer-new-page"

export const Route = createFileRoute("/customers_/new")({
  beforeLoad: () => requireFeatureAndModuleAccess("customers", "customers"),
  component: CustomerNewPage,
})
