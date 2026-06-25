import { useEffect, useRef, useState } from "react"
import { getRouteApi, Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ContextPanel } from "@/components/support/context-panel"
import { ConversationView } from "@/components/support/conversation-view"
import { useSupport } from "@/components/support/support-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { APP_TITLE, documentTitleForPath } from "@/lib/route-meta"
import { cn } from "@/lib/utils"

const route = getRouteApi("/support/$ticketId")

// The /support list route validates required search params, so navigations
// back to it must supply defaults.
const LIST_SEARCH = { status: "open" as const, q: "", page: 1 }

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

export default function SupportConversationPage() {
  const { ticketId } = route.useParams()
  const navigate = route.useNavigate()
  const inbox = useSupport()
  const { selectTicket, selectedTicket, loadingDetail } = inbox

  const [detailsOpen, setDetailsOpen] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isDesktop = useIsDesktop()
  const sawLoading = useRef(false)

  useEffect(() => {
    sawLoading.current = false
    selectTicket(ticketId)
    return () => selectTicket(null)
  }, [selectTicket, ticketId])

  useEffect(() => {
    if (loadingDetail) sawLoading.current = true
  }, [loadingDetail])

  // The ticket id was invalid or not visible to this org: send the agent back.
  useEffect(() => {
    if (sawLoading.current && !loadingDetail && !selectedTicket) {
      void navigate({ to: "/support", search: LIST_SEARCH })
    }
  }, [loadingDetail, navigate, selectedTicket])

  useEffect(() => {
    if (!selectedTicket) {
      document.title = documentTitleForPath(`/support/${ticketId}`)
      return
    }

    const requester = selectedTicket.requester.name.trim() || selectedTicket.requester.email
    document.title = `#${selectedTicket.ticketNumber} ${requester} - Support - ${APP_TITLE}`
  }, [selectedTicket, ticketId])

  const handleArchiveToggle = async () => {
    if (!selectedTicket) return
    const ok = selectedTicket.isArchived
      ? await inbox.unarchiveTicket(selectedTicket.id)
      : await inbox.archiveTicket(selectedTicket.id)
    if (ok) toast.success(selectedTicket.isArchived ? "Conversation unarchived" : "Conversation archived")
  }

  const handleConfirmDelete = async () => {
    if (!selectedTicket) return
    setDeleting(true)
    const ok = await inbox.deleteTicket(selectedTicket.id)
    setDeleting(false)
    if (ok) {
      toast.success("Conversation deleted")
      setDeleteOpen(false)
      void navigate({ to: "/support", search: LIST_SEARCH })
    }
  }

  const showContext = detailsOpen && Boolean(selectedTicket)

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Support", href: "/support" },
          { label: selectedTicket ? `#${selectedTicket.ticketNumber}` : "Conversation" },
        ]}
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/support" search={LIST_SEARCH}>
                <ArrowLeftIcon />
                Back to Tickets
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col bg-background">
        {inbox.error && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
            {inbox.error}
          </div>
        )}

        {!selectedTicket && loadingDetail ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ConversationView
                inbox={inbox}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen((open) => !open)}
                onArchiveToggle={() => void handleArchiveToggle()}
                onDelete={() => setDeleteOpen(true)}
              />
            </div>

            {showContext && isDesktop && (
              <aside className="hidden w-80 shrink-0 border-l lg:block xl:w-[22rem]">
                <ContextPanel
                  ticket={selectedTicket!}
                  messages={inbox.messages}
                  onSelectTicket={(id) =>
                    void navigate({ to: "/support/$ticketId", params: { ticketId: id } })
                  }
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
                    ticket={selectedTicket!}
                    messages={inbox.messages}
                    onSelectTicket={(id) =>
                      void navigate({ to: "/support/$ticketId", params: { ticketId: id } })
                    }
                  />
                </aside>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              {selectedTicket
                ? `This permanently deletes the chat with ${selectedTicket.requester.name} (#${selectedTicket.ticketNumber}), all its messages, and any uploaded files. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleConfirmDelete()}>
              {deleting ? "Deleting..." : "Delete Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
