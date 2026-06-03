import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProjectsPage from "@/pages/projects-page"

export const Route = createFileRoute("/projects")({
  beforeLoad: () => requireModuleAccess("projects"),
  component: ProjectsPage,
})
