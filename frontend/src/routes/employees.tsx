import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import EmployeesPage from "@/pages/employees-page"

export const Route = createFileRoute("/employees")({
  beforeLoad: () => requireModuleAccess("employees"),
  component: EmployeesPage,
})
