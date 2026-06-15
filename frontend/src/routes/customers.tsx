import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import CustomersPage from "@/pages/customers-page"

export const Route = createFileRoute("/customers")({
  beforeLoad: () => requireFeatureAndModuleAccess("customers", "customers"),
  component: CustomersPage,
})
