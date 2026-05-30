import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/forms")({
  beforeLoad: () => requireFeatureAndModuleAccess("forms", "forms"),
  component: () => <Outlet />,
})
