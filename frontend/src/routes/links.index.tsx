import { createFileRoute } from "@tanstack/react-router"

import LinksDashboardPage from "@/pages/links-dashboard-page"

export const Route = createFileRoute("/links/")({
  component: LinksDashboardPage,
})
