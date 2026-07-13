import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentJobsPage } from "@/pages/recruitment-list-pages"

export const Route = createFileRoute("/recruitment_/jobs")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentJobsPage,
})
