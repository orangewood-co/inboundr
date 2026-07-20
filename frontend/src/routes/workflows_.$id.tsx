import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import WorkflowEditorPage from "@/pages/workflow-editor-page"

export const Route = createFileRoute("/workflows_/$id")({
  beforeLoad: () => requireFeatureAndModuleAccess("workflows", "rfq"),
  component: WorkflowEditorPage,
})
