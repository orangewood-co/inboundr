import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AssetsSettingsPage from "@/pages/assets-settings-page"

export const Route = createFileRoute("/assets_/settings")({
  beforeLoad: () => requireFeatureAndModuleAccess("assets", "assets"),
  component: AssetsSettingsPage,
})
