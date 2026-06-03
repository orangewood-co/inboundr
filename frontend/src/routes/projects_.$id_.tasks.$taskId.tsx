import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProjectTaskPage from "@/pages/project-task-page"

export const Route = createFileRoute("/projects_/$id_/tasks/$taskId")({
  beforeLoad: () => requireModuleAccess("projects"),
  component: ProjectTaskPage,
})
