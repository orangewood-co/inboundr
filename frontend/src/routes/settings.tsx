import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import SettingsPage from "@/pages/settings-page"

export const Route = createFileRoute("/settings")({
  beforeLoad: requireSession,
  component: SettingsPage,
})
