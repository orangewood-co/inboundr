import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import InvoicesPage from "@/pages/invoices-page"

export const Route = createFileRoute("/invoices")({
  beforeLoad: requireSession,
  component: InvoicesPage,
})
