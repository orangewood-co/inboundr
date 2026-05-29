import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import OrdersPage from "@/pages/orders-page"

export const Route = createFileRoute("/orders")({
  beforeLoad: requireSession,
  component: OrdersPage,
})
