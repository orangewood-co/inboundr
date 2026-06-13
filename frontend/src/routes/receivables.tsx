import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ReceivablesPage from "@/pages/receivables-page"

export const Route = createFileRoute("/receivables")({
  beforeLoad: () => requireFeatureAndModuleAccess("invoices", "invoices"),
  component: ReceivablesPage,
})
