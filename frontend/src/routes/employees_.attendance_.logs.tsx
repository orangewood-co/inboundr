import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import AttendanceLogsPage from "@/pages/attendance-logs-page"

export const Route = createFileRoute("/employees_/attendance_/logs")({
  beforeLoad: () => requireFeatureAndModuleAccess("employees", "employees"),
  component: AttendanceLogsPage,
})
