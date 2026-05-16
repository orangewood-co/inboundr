import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import LinksPage from "@/pages/links-page"

export const Route = createFileRoute("/links")({
  beforeLoad: requireSession,
  component: LinksPage,
})
