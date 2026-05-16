import { createFileRoute } from "@tanstack/react-router"

import LinksDetailPage from "@/pages/links-detail-page"

export const Route = createFileRoute("/links/$id")({
  component: LinksDetailPage,
})
