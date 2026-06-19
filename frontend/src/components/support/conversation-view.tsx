import { useMemo } from "react"
import { MessagesSquareIcon } from "lucide-react"

import { Composer } from "./composer"
import { ConversationHeader } from "./conversation-header"
import { MessageTimeline } from "./message-timeline"
import type { SupportInbox } from "./support-provider"

export function ConversationView({
  inbox,
  detailsOpen,
  onToggleDetails,
}: {
  inbox: SupportInbox
  detailsOpen: boolean
  onToggleDetails: () => void
}) {
  const ticket = inbox.selectedTicket
  const notesCount = useMemo(
    () => inbox.messages.filter((message) => message.isInternal).length,
    [inbox.messages]
  )

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background px-6 text-center text-muted-foreground">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <MessagesSquareIcon className="size-8" />
        </div>
        <p className="text-sm font-medium text-foreground">Select a Conversation</p>
        <p className="mt-1 max-w-xs text-sm">
          Choose a support conversation from the list to read and reply to messages.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ConversationHeader
        ticket={ticket}
        notesCount={notesCount}
        socketReady={inbox.socketReady}
        detailsOpen={detailsOpen}
        onToggleDetails={onToggleDetails}
        onResolveToggle={() => inbox.setStatus(ticket.status !== "resolved")}
      />
      <MessageTimeline
        ticket={ticket}
        messages={inbox.messages}
        loading={inbox.loadingDetail}
        visitorTyping={inbox.visitorTyping}
        latestAgentMessage={inbox.latestAgentMessage}
        latestVisitorMessage={inbox.latestVisitorMessage}
        latestAgentSeenByVisitor={inbox.latestAgentSeenByVisitor}
        latestVisitorSeenByAgent={inbox.latestVisitorSeenByAgent}
      />
      <Composer
        ticket={ticket}
        sending={inbox.sending}
        socketReady={inbox.socketReady}
        onSend={inbox.sendMessage}
        onDraftChange={inbox.handleDraftChange}
      />
    </div>
  )
}
