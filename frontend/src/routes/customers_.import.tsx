import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import CustomersImportPage from "@/pages/customers-import-page"

export const Route = createFileRoute("/customers_/import")({
  beforeLoad: () => requireFeatureAndModuleAccess("customers", "customers"),
  component: CustomersImportPage,
})
