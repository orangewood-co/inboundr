import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentOverviewPage } from "@/pages/recruitment-list-pages"

export const Route = createFileRoute("/recruitment")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentOverviewPage,
})
