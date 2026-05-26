import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireFeatureAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/invoices")({
  beforeLoad: () => requireFeatureAccess("invoices"),
  component: () => <Outlet />,
})
