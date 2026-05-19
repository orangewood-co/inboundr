import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import CustomerDetailPage from "@/pages/customer-detail-page"

export const Route = createFileRoute("/customers_/$id")({
  beforeLoad: requireSession,
  component: CustomerDetailPage,
})
