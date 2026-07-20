import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import WorkflowsPage from "@/pages/workflows-page"

export const Route = createFileRoute("/workflows")({
  beforeLoad: () => requireFeatureAndModuleAccess("workflows", "rfq"),
  component: WorkflowsPage,
})
