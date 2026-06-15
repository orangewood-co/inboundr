import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AttendancePage from "@/pages/attendance-page"

export const Route = createFileRoute("/employees_/attendance")({
  beforeLoad: () => requireFeatureAndModuleAccess("employees", "employees"),
  component: AttendancePage,
})
