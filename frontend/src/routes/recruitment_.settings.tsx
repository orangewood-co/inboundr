import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import { RecruitmentSettingsPage } from "@/pages/recruitment-settings-page"

export const Route = createFileRoute("/recruitment_/settings")({
  beforeLoad: () => requireFeatureAndModuleAccess("recruitment", "recruitment"),
  component: RecruitmentSettingsPage,
})
