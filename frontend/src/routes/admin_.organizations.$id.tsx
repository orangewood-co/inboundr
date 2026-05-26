import { createFileRoute } from "@tanstack/react-router"

import { requireSuperAdmin } from "@/lib/auth-guards"
import AdminOrganizationPage from "@/pages/admin-organization-page"

export const Route = createFileRoute("/admin_/organizations/$id")({
  beforeLoad: requireSuperAdmin,
  component: AdminOrganizationPage,
})
