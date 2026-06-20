import { useMemo } from "react"
import { MessagesSquareIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Composer } from "./composer"
import { ConversationHeader } from "./conversation-header"
import { MessageTimeline } from "./message-timeline"
import type { SupportInbox } from "./support-provider"

export function ConversationView({
  inbox,
  detailsOpen,
  onToggleDetails,
  onArchiveToggle,
  onDelete,
}: {
  inbox: SupportInbox
  detailsOpen: boolean
  onToggleDetails: () => void
  onArchiveToggle: () => void
  onDelete: () => void
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
        onAiModeChange={inbox.setAiMode}
        onArchiveToggle={onArchiveToggle}
        onDelete={onDelete}
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
        aiDrafts={inbox.aiDrafts}
        approvingDraft={inbox.sending}
        onApproveDraft={inbox.approveAiDraft}
        onRejectDraft={inbox.rejectAiDraft}
      />
      {ticket.aiMode === "review" && (
        <div className="flex items-center justify-between gap-3 border-t bg-accent/30 px-4 py-2 text-xs text-muted-foreground">
          <span>Human review mode is on. Generate an AI suggestion when you want help drafting.</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => void inbox.generateAiDraft()}
            disabled={inbox.sending || inbox.aiDrafts.length > 0}
          >
            <SparklesIcon className="size-3.5" />
            Generate AI Reply
          </Button>
        </div>
      )}
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
