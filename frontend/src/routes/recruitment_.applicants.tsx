import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentApplicantsPage } from "@/pages/recruitment-list-pages"

export const Route = createFileRoute("/recruitment_/applicants")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentApplicantsPage,
})
