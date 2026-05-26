import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireFeatureAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/links")({
  beforeLoad: () => requireFeatureAccess("links"),
  component: () => <Outlet />,
})
