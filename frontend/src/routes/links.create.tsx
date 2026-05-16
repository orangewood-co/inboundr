import { createFileRoute } from "@tanstack/react-router"

import LinksCreatePage from "@/pages/links-create-page"

export const Route = createFileRoute("/links/create")({
  component: LinksCreatePage,
})
