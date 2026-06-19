import { createFileRoute } from "@tanstack/react-router"

import SupportConversationPage from "@/pages/support-conversation-page"

export const Route = createFileRoute("/support/$ticketId")({
  component: SupportConversationPage,
})
