import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import CustomersPage from "@/pages/customers-page"

export const Route = createFileRoute("/customers")({
  beforeLoad: () => requireModuleAccess("customers"),
  component: CustomersPage,
})
