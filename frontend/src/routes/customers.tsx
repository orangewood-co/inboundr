import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import CustomersPage from "@/pages/customers-page"

export const Route = createFileRoute("/customers")({
  beforeLoad: requireSession,
  component: CustomersPage,
})
