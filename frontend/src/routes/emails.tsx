import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import EmailsPage from "@/pages/emails-page"

export const Route = createFileRoute("/emails")({
  beforeLoad: () => requireModuleAccess("inbox"),
  component: EmailsPage,
})
