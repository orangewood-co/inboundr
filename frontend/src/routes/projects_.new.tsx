import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProjectNewPage from "@/pages/project-new-page"

export const Route = createFileRoute("/projects_/new")({
  beforeLoad: () => requireModuleAccess("projects"),
  component: ProjectNewPage,
})
