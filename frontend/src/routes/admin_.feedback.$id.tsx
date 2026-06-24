import { createFileRoute } from "@tanstack/react-router"

import { requireSuperAdmin } from "@/lib/auth-guards"
import AdminFeedbackDetailPage from "@/pages/admin-feedback-detail-page"

export const Route = createFileRoute("/admin_/feedback/$id")({
  beforeLoad: requireSuperAdmin,
  component: AdminFeedbackDetailPage,
})
