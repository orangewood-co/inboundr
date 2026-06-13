import { createFileRoute } from "@tanstack/react-router"

import CallsSettingsPage from "@/pages/calls-settings-page"

export const Route = createFileRoute("/calls/settings")({
  component: CallsSettingsPage,
})
