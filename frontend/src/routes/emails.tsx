import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmailsPage from "@/pages/emails-page"

export const Route = createFileRoute("/emails")({
  beforeLoad: () => requireFeatureAndModuleAccess("inbox", "inbox"),
  component: EmailsPage,
})
