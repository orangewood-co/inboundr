import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/invoices")({
  beforeLoad: () => requireFeatureAndModuleAccess("invoices", "invoices"),
  component: () => <Outlet />,
})
