import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import EmployeesPage from "@/pages/employees-page"

export const Route = createFileRoute("/employees")({
  beforeLoad: () => requireFeatureAndModuleAccess("employees", "employees"),
  component: EmployeesPage,
})
