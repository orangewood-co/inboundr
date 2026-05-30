import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import EmployeeNewPage from "@/pages/employee-new-page"

export const Route = createFileRoute("/employees_/new")({
  beforeLoad: () => requireModuleAccess("employees"),
  component: EmployeeNewPage,
})
