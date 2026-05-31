import { createFileRoute } from "@tanstack/react-router"

import DrivePage from "@/pages/drive-page"

export const Route = createFileRoute("/drive")({
  component: DrivePage,
})
