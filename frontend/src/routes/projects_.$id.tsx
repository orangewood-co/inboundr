import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProjectDetailPage from "@/pages/project-detail-page"

export const Route = createFileRoute("/projects_/$id")({
  beforeLoad: () => requireModuleAccess("projects"),
  component: ProjectDetailPage,
})
