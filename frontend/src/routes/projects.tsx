import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProjectsPage from "@/pages/projects-page"

export const Route = createFileRoute("/projects")({
  beforeLoad: () => requireFeatureAndModuleAccess("projects", "projects"),
  component: ProjectsPage,
})
