import { useEffect, useState } from "react"
import { CopyIcon, ExternalLinkIcon, RefreshCcwIcon } from "lucide-react"
import { useDefaultLayout } from "react-resizable-panels"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ContextPanel } from "@/components/support/context-panel"
import { ConversationList } from "@/components/support/conversation-list"
import { ConversationView } from "@/components/support/conversation-view"
import { useSupportInbox } from "@/components/support/use-support-inbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn, copyToClipboard } from "@/lib/utils"

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  )
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    query.addEventListener("change", handler)
    return () => query.removeEventListener("change", handler)
  }, [])
  return isDesktop
}

export default function SupportPage() {
  const inbox = useSupportInbox()
  const [detailsOpen, setDetailsOpen] = useState(true)
  const isDesktop = useIsDesktop()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "btsa:layout:support",
    storage: localStorage,
  })

  const showContext = detailsOpen && Boolean(inbox.selectedTicket)

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Support" }]}
        actions={
          <>
            <Badge variant={inbox.socketReady ? "secondary" : "outline"} className="gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  inbox.socketReady ? "bg-emerald-500" : "animate-pulse bg-amber-500"
                )}
              />
              {inbox.socketReady ? "Realtime" : "Connecting"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void inbox.refresh()}>
              <RefreshCcwIcon />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col bg-background">
        {inbox.supportChatLink && (
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Public chat link</span>
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-foreground">
              {inbox.supportChatLink}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(inbox.supportChatLink, "Support chat link copied")}
            >
              <CopyIcon />
              Copy
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={inbox.supportChatLink} target="_blank" rel="noreferrer" aria-label="Open support chat">
                <ExternalLinkIcon />
              </a>
            </Button>
          </div>
        )}

        {inbox.error && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
            {inbox.error}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
            className="min-w-0 flex-1"
          >
            <ResizablePanel id="list" defaultSize="28%" minSize="20%" maxSize="42%" className="flex min-w-0 flex-col overflow-hidden">
              <ConversationList
                filter={inbox.filter}
                onFilterChange={inbox.setFilter}
                tickets={inbox.tickets}
                loading={inbox.loadingTickets}
                unreadCount={inbox.unreadCount}
                selectedTicketId={inbox.selectedTicketId}
                onSelect={inbox.selectTicket}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="conversation" defaultSize="72%" minSize="34%" className="flex min-w-0 flex-col overflow-hidden">
              <ConversationView
                inbox={inbox}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen((open) => !open)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>

          {showContext && isDesktop && (
            <aside className="hidden w-80 shrink-0 border-l lg:block xl:w-[22rem]">
              <ContextPanel
                ticket={inbox.selectedTicket!}
                messages={inbox.messages}
                onSelectTicket={inbox.selectTicket}
              />
            </aside>
          )}

          {showContext && !isDesktop && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close details"
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={() => setDetailsOpen(false)}
              />
              <aside className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col border-l bg-background shadow-xl">
                <ContextPanel
                  ticket={inbox.selectedTicket!}
                  messages={inbox.messages}
                  onSelectTicket={inbox.selectTicket}
                />
              </aside>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
