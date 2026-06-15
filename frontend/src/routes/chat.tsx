import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ChatPage from "@/pages/chat-page"

export const Route = createFileRoute("/chat")({
  beforeLoad: () => requireFeatureAndModuleAccess("chat", "chat"),
  component: ChatPage,
})
