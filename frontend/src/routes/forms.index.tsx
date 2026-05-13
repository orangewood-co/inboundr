import { createFileRoute } from "@tanstack/react-router"

import FormsListPage from "@/pages/forms-list-page"

export const Route = createFileRoute("/forms/")({
  component: FormsListPage,
})
