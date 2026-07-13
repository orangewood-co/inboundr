import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentJobDetailPage } from "@/pages/recruitment-job-pages"

export const Route = createFileRoute("/recruitment_/jobs_/$jobId")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentJobDetailPage,
})
