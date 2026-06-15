import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmployeeDetailPage from "@/pages/employee-detail-page"

export const Route = createFileRoute("/employees_/$id")({
  beforeLoad: () => requireFeatureAndModuleAccess("employees", "employees"),
  component: EmployeeDetailPage,
})
