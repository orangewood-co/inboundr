import { createFileRoute, Outlet } from "@tanstack/react-router"

import { SupportProvider } from "@/components/support/support-provider"
import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"

export const Route = createFileRoute("/support")({
  beforeLoad: () => requireFeatureAndModuleAccess("support", "support"),
  component: () => (
    <SupportProvider>
      <Outlet />
    </SupportProvider>
  ),
})
