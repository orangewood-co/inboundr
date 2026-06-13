import { createFileRoute } from "@tanstack/react-router"

import CallsPage from "@/pages/calls-page"

export const Route = createFileRoute("/calls/")({
  component: CallsPage,
})
