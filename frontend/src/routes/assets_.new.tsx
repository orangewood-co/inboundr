import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AssetNewPage from "@/pages/asset-new-page"

export const Route = createFileRoute("/assets_/new")({
  beforeLoad: () => requireFeatureAndModuleAccess("assets", "assets"),
  component: AssetNewPage,
})
