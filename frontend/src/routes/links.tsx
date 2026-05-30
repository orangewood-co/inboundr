import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/links")({
  beforeLoad: () => requireFeatureAndModuleAccess("links", "links"),
  component: () => <Outlet />,
})
