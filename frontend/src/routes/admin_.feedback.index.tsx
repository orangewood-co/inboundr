import { createFileRoute } from "@tanstack/react-router"

import { requireSuperAdmin } from "@/lib/auth-guards"
import AdminFeedbackPage from "@/pages/admin-feedback-page"

export const Route = createFileRoute("/admin_/feedback/")({
  beforeLoad: requireSuperAdmin,
  component: AdminFeedbackPage,
})
