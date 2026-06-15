import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProjectTaskPage from "@/pages/project-task-page"

export const Route = createFileRoute("/projects_/$id_/tasks/$taskId")({
  beforeLoad: () => requireFeatureAndModuleAccess("projects", "projects"),
  component: ProjectTaskPage,
})
