import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentJobFormPage } from "@/pages/recruitment-job-pages"

export const Route = createFileRoute("/recruitment_/jobs_/new")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentJobFormPage,
})
