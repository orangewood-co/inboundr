import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import FeedbackPage from "@/pages/feedback-page"

export const Route = createFileRoute("/feedback")({
  beforeLoad: requireSession,
  component: FeedbackPage,
})
