import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProjectDetailPage from "@/pages/project-detail-page"

export const Route = createFileRoute("/projects_/$id")({
  beforeLoad: () => requireFeatureAndModuleAccess("projects", "projects"),
  component: ProjectDetailPage,
})
