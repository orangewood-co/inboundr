import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import FormsPage from "@/pages/forms-page"

export const Route = createFileRoute("/forms")({
  beforeLoad: requireSession,
  component: FormsPage,
})
