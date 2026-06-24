import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireSuperAdmin } from "@/lib/auth-guards"

export const Route = createFileRoute("/admin_/feedback")({
  beforeLoad: requireSuperAdmin,
  component: () => <Outlet />,
})
