import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearch } from "@tanstack/react-router"
import { useDefaultLayout } from "react-resizable-panels"
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessagesSquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ContextPanel } from "@/components/support/context-panel"
import type { ConversationFilterValue } from "@/components/support/conversation-filters"
import { ConversationList } from "@/components/support/conversation-list"
import { ConversationView } from "@/components/support/conversation-view"
import {
  RealtimeIndicator,
  SupportHeaderActions,
} from "@/components/support/support-header-actions"
import { useSupport } from "@/components/support/support-provider"
import type { TicketFilter } from "@/components/support/types"
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"
import { APP_TITLE, documentTitleForPath } from "@/lib/route-meta"
import { setTabBaseTitle } from "@/lib/tab-indicator"

const PAGE_SIZE = 25

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

function ThreadPlaceholder() {
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

export default function SupportInboxPage() {
  const search = useSearch({ from: "/support" })
  const params = useParams({ strict: false })
  const ticketId = params.ticketId ?? null
  const navigate = useNavigate()
  const inbox = useSupport()
  const { loadTickets, selectTicket, selectedTicket, loadingDetail } = inbox
  const isDesktop = useIsDesktop()

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "inboundr:layout:support",
    storage: localStorage,
  })

  const updateSearch = (patch: Partial<typeof search>) => {
    if (ticketId) {
      void navigate({
        to: "/support/$ticketId",
        params: { ticketId },
        search: (prev) => ({ ...prev, ...patch }),
      })
    } else {
      void navigate({ to: "/support", search: (prev) => ({ ...prev, ...patch }) })
    }
  }

  const [searchInput, setSearchInput] = useState(search.q)
  const lastSyncedQuery = useRef(search.q)

  // Keep the input in sync when the URL query changes from outside (e.g. Back).
  useEffect(() => {
    if (search.q !== lastSyncedQuery.current) {
      lastSyncedQuery.current = search.q
      setSearchInput(search.q)
    }
  }, [search.q])

  // Debounce the search box into the URL (resetting to page 1).
  useEffect(() => {
    if (searchInput === search.q) return
    const handle = window.setTimeout(() => {
      lastSyncedQuery.current = searchInput
      updateSearch({ q: searchInput, page: 1 })
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.q, searchInput])

  // Fetch whenever the resolved query changes.
  const tagsKey = search.tags.join(",")
  useEffect(() => {
    void loadTickets({
      status: search.status,
      search: search.q,
      tags: search.tags,
      resolutionReason: search.reason,
      sort: search.sort,
      dateField: search.dateField,
      dateFrom: search.from,
      dateTo: search.to,
      page: search.page,
      limit: PAGE_SIZE,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTickets, search.status, search.q, tagsKey, search.reason, search.sort, search.dateField, search.from, search.to, search.page])

  // The URL param drives which conversation is loaded in the thread pane.
  const sawLoading = useRef(false)
  useEffect(() => {
    sawLoading.current = false
    selectTicket(ticketId)
  }, [selectTicket, ticketId])

  useEffect(() => () => selectTicket(null), [selectTicket])

  useEffect(() => {
    if (loadingDetail) sawLoading.current = true
  }, [loadingDetail])

  // The ticket id was invalid or not visible to this org: clear the selection.
  useEffect(() => {
    if (ticketId && sawLoading.current && !loadingDetail && !selectedTicket) {
      void navigate({ to: "/support", search: (prev) => prev })
    }
  }, [loadingDetail, navigate, selectedTicket, ticketId])

  useEffect(() => {
    if (!ticketId) {
      setTabBaseTitle(documentTitleForPath("/support"))
      return
    }
    if (!selectedTicket) {
      setTabBaseTitle(documentTitleForPath(`/support/${ticketId}`))
      return
    }
    const requester = selectedTicket.requester.name.trim() || selectedTicket.requester.email
    setTabBaseTitle(`${selectedTicket.ticketReference} ${requester} - Support - ${APP_TITLE}`)
  }, [selectedTicket, ticketId])

  const openTicket = (id: string) =>
    void navigate({ to: "/support/$ticketId", params: { ticketId: id }, search })
  const backToList = () => void navigate({ to: "/support", search })

  const setStatus = (status: TicketFilter) =>
    updateSearch({ status, reason: status === "resolved" ? search.reason : "", page: 1 })
  const setPage = (page: number) => updateSearch({ page })

  const filters: ConversationFilterValue = {
    sort: search.sort,
    tags: search.tags,
    reason: search.reason,
    dateField: search.dateField,
    from: search.from,
    to: search.to,
  }
  const changeFilters = (patch: Partial<ConversationFilterValue>) =>
    updateSearch({ ...patch, page: 1 })
  const clearFilters = () =>
    updateSearch({
      sort: "recent",
      tags: [],
      reason: "",
      dateField: "created",
      from: "",
      to: "",
      page: 1,
    })

  const [detailsOpen, setDetailsOpen] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      backToList()
    }
  }

  const { pagination } = inbox
  const ticketReady = Boolean(selectedTicket && selectedTicket.id === ticketId)
  const showContext = detailsOpen && ticketReady

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ConversationList
          filter={search.status}
          onFilterChange={setStatus}
          tickets={inbox.tickets}
          loading={inbox.loadingTickets}
          unreadCount={inbox.unreadCount}
          selectedTicketId={ticketId}
          onSelect={openTicket}
          search={searchInput}
          onSearchChange={setSearchInput}
          filters={filters}
          onFiltersChange={changeFilters}
          onFiltersClear={clearFilters}
          ticketTags={inbox.ticketTags}
          resolutionReasons={inbox.resolutionReasons}
        />
      </div>
      {!inbox.loadingTickets && pagination.total > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {pagination.total === 1 ? "1 conversation" : `${pagination.total} conversations`}
            {" · "}Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const threadContent = !ticketId ? (
    <ThreadPlaceholder />
  ) : !ticketReady ? (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ) : (
    <ConversationView
      inbox={inbox}
      detailsOpen={detailsOpen}
      onToggleDetails={() => setDetailsOpen((open) => !open)}
      onArchiveToggle={() => void handleArchiveToggle()}
      onDelete={() => setDeleteOpen(true)}
    />
  )

  const threadPane = (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{threadContent}</div>
      {showContext && isDesktop && (
        <aside className="hidden w-80 shrink-0 border-l lg:block xl:w-[22rem]">
          <ContextPanel
            ticket={selectedTicket!}
            messages={inbox.messages}
            onSelectTicket={openTicket}
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
              onSelectTicket={openTicket}
            />
          </aside>
        </div>
      )}
    </div>
  )

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={
          ticketReady
            ? [
                { label: "Support", href: "/support" },
                { label: selectedTicket!.ticketReference },
              ]
            : [{ label: "Support" }]
        }
        leadingActions={<RealtimeIndicator />}
        actions={<SupportHeaderActions />}
      />

      {inbox.error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {inbox.error}
        </div>
      )}

      {isDesktop ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePanel
            id="list"
            defaultSize="26%"
            minSize="18%"
            maxSize="40%"
            className="flex min-w-0 flex-col overflow-hidden"
          >
            {listPane}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="thread" className="flex min-w-0 flex-col overflow-hidden">
            {threadPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : ticketId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Button variant="ghost" size="sm" onClick={backToList}>
              <ArrowLeftIcon />
              Back to List
            </Button>
          </div>
          <div className="min-h-0 flex-1">{threadPane}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">{listPane}</div>
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              {selectedTicket
                ? `This permanently deletes the chat with ${selectedTicket.requester.name} (${selectedTicket.ticketReference}), all its messages, and any uploaded files. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Deleting..." : "Delete Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
