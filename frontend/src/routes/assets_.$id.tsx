import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AssetDetailPage from "@/pages/asset-detail-page"

export const Route = createFileRoute("/assets_/$id")({
  beforeLoad: () => requireFeatureAndModuleAccess("assets", "assets"),
  component: AssetDetailPage,
})
