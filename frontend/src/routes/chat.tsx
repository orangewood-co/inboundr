import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import ChatPage from "@/pages/chat-page"

export const Route = createFileRoute("/chat")({
  beforeLoad: requireSession,
  component: ChatPage,
})
