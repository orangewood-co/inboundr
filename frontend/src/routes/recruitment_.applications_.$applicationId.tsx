import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import RecruitmentApplicationDetailPage from "@/pages/recruitment-application-detail-page"

export const Route = createFileRoute("/recruitment_/applications_/$applicationId")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentApplicationDetailPage,
})
