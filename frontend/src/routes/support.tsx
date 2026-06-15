import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import SupportPage from "@/pages/support-page"

export const Route = createFileRoute("/support")({
  beforeLoad: () => requireFeatureAndModuleAccess("support", "support"),
  component: SupportPage,
})
