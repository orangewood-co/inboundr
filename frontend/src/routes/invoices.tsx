import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"

export const Route = createFileRoute("/invoices")({
  beforeLoad: requireSession,
  component: () => <Outlet />,
})
