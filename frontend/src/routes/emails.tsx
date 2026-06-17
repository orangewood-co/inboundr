import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmailsPage from "@/pages/emails-page"

type EmailsRouteSearch = {
  email?: string
}

export const Route = createFileRoute("/emails")({
  beforeLoad: () => requireFeatureAndModuleAccess("inbox", "inbox"),
  validateSearch: (search: Record<string, unknown>): EmailsRouteSearch => ({
    email: typeof search.email === "string" && search.email.trim() ? search.email : undefined,
  }),
  component: EmailsPage,
})
