import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import OrdersPage from "@/pages/orders-page"

export const Route = createFileRoute("/orders")({
  beforeLoad: () => requireFeatureAndModuleAccess("rfq", "rfq"),
  component: OrdersPage,
})
