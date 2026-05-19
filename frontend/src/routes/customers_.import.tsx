import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import CustomersImportPage from "@/pages/customers-import-page"

export const Route = createFileRoute("/customers_/import")({
  beforeLoad: requireSession,
  component: CustomersImportPage,
})
