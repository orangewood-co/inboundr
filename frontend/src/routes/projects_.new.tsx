import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProjectNewPage from "@/pages/project-new-page"

export const Route = createFileRoute("/projects_/new")({
  beforeLoad: () => requireFeatureAndModuleAccess("projects", "projects"),
  component: ProjectNewPage,
})
