import { createFileRoute } from "@tanstack/react-router"

import { requireSuperAdmin } from "@/lib/auth-guards"
import AdminPage from "@/pages/admin-page"

export const Route = createFileRoute("/admin")({
  beforeLoad: requireSuperAdmin,
  component: AdminPage,
})
