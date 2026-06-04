import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import AttendancePage from "@/pages/attendance-page"

export const Route = createFileRoute("/employees_/attendance")({
  beforeLoad: () => requireModuleAccess("employees"),
  component: AttendancePage,
})
