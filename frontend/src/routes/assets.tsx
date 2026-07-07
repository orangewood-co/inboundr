import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AssetsPage from "@/pages/assets-page"

export const Route = createFileRoute("/assets")({
  beforeLoad: () => requireFeatureAndModuleAccess("assets", "assets"),
  component: AssetsPage,
})
