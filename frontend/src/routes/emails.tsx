import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import EmailsPage from "@/pages/emails-page"

export const Route = createFileRoute("/emails")({
  beforeLoad: requireSession,
  component: EmailsPage,
})
