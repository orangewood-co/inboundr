import { createFileRoute } from "@tanstack/react-router"

import EmailsPage from "@/pages/emails-page"

export const Route = createFileRoute("/emails")({
  component: EmailsPage,
})
