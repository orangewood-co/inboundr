import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import EmployeeDetailPage from "@/pages/employee-detail-page"

export const Route = createFileRoute("/employees_/$id")({
  beforeLoad: () => requireModuleAccess("employees"),
  component: EmployeeDetailPage,
})
