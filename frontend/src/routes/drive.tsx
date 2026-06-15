import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import DrivePage from "@/pages/drive-page"

export const Route = createFileRoute("/drive")({
  beforeLoad: () => requireFeatureAndModuleAccess("drive", "drive"),
  component: DrivePage,
})
