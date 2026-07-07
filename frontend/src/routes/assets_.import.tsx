import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AssetsImportPage from "@/pages/assets-import-page"

export const Route = createFileRoute("/assets_/import")({
  beforeLoad: () => requireFeatureAndModuleAccess("assets", "assets"),
  component: AssetsImportPage,
})
