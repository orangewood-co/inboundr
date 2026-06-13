import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import SupportPage from "@/pages/support-page"

export const Route = createFileRoute("/support")({
  beforeLoad: requireSession,
  component: SupportPage,
})
