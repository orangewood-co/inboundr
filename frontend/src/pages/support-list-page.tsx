import { useEffect, useMemo, useRef, useState } from "react"
import { getRouteApi } from "@tanstack/react-router"
import {
  CopyIcon,
  ExternalLinkIcon,
  InboxIcon,
  LinkIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageHeader } from "@/components/page-header"
import { STATUS_STYLES } from "@/components/support/context-panel"
import { useSupport } from "@/components/support/support-provider"
import { formatFullTime, formatRelativeTime, initialsFromName, isUnread } from "@/components/support/support-utils"
import type { Ticket, TicketFilter } from "@/components/support/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, copyToClipboard, getAvatarColor } from "@/lib/utils"

const PAGE_SIZE = 25

const TICKET_FILTERS: { value: TicketFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
]

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
}

const route = getRouteApi("/support/")

function ChatWidgetLink({ link }: { link: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon />
          Get Chat Widget Link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium">Public Chat Link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this URL or embed it so visitors can start a support chat.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs text-foreground">
            {link}
          </code>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Copy link"
            onClick={() => copyToClipboard(link, "Support chat link copied")}
          >
            <CopyIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={link} target="_blank" rel="noreferrer" aria-label="Open support chat">
              <ExternalLinkIcon />
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function paginationRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("ellipsis")
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < total - 1) pages.push("ellipsis")
  pages.push(total)
  return pages
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: (id: string) => void }) {
  const unread = isUnread(ticket)
  const avatar = getAvatarColor(ticket.requester.name)
  const preview = ticket.lastMessagePreview?.trim()

  return (
    <TableRow
      className={cn("cursor-pointer transition-colors", unread && "bg-primary/[0.035]")}
      onClick={() => onOpen(ticket.id)}
    >
      <TableCell>
        <Badge
          variant="secondary"
          className={cn("border-transparent font-medium", STATUS_STYLES[ticket.status])}
        >
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">#{ticket.ticketNumber}</TableCell>
      <TableCell className="max-w-0">
        <div className="flex items-center gap-2">
          {unread && (
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
          )}
          <div className="min-w-0">
            <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>
              {ticket.subject || "New support chat"}
            </p>
            {preview && <p className="truncate text-xs text-muted-foreground">{preview}</p>}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className={cn("text-xs font-medium", avatar.bg, avatar.text)}>
              {initialsFromName(ticket.requester.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ticket.requester.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ticket.requester.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{formatRelativeTime(ticket.lastMessageAt)}</span>
          </TooltipTrigger>
          <TooltipContent>{formatFullTime(ticket.lastMessageAt)}</TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  )
}

export default function SupportListPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const inbox = useSupport()
  const { loadTickets } = inbox

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
      void navigate({ search: (prev) => ({ ...prev, q: searchInput, page: 1 }) })
    }, 300)
    return () => window.clearTimeout(handle)
  }, [navigate, search.q, searchInput])

  // Fetch whenever the resolved query changes.
  useEffect(() => {
    void loadTickets({ status: search.status, search: search.q, page: search.page, limit: PAGE_SIZE })
  }, [loadTickets, search.status, search.q, search.page])

  const setStatus = (status: TicketFilter) =>
    void navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })
  const setPage = (page: number) => void navigate({ search: (prev) => ({ ...prev, page }) })

  const { pagination, tickets, loadingTickets, unreadCount, error } = inbox
  const pages = useMemo(
    () => paginationRange(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages]
  )

  const openTicket = (id: string) => void navigate({ to: "/support/$ticketId", params: { ticketId: id } })

  const description =
    pagination.total === 1 ? "1 conversation" : `${pagination.total} conversations`

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

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          <PageHeader
            title="Support"
            description={description}
            actions={inbox.supportChatLink ? <ChatWidgetLink link={inbox.supportChatLink} /> : null}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-[3px]">
              {TICKET_FILTERS.map((item) => {
                const active = search.status === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={cn(
                      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {item.value === "open" && unreadCount > 0 && (
                      <span
                        className={cn(
                          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                          active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                        )}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by subject, name, email, or #"
                className="pl-8"
              />
            </div>
          </div>

          {error ? (
            <ErrorState
              className="mt-6 rounded-xl border"
              message={error}
              onRetry={() => void inbox.refresh()}
            />
          ) : loadingTickets ? (
            <ListSkeleton rows={8} columns={5} className="mt-6 rounded-xl border" />
          ) : tickets.length === 0 ? (
            <EmptyState
              className="mt-6 rounded-xl border border-dashed"
              icon={InboxIcon}
              title={search.q ? "No Matches Found" : "No Conversations Yet"}
              description={
                search.q
                  ? "Try a different subject, name, email, or ticket number."
                  : "New support chats from your customers will appear here."
              }
            />
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-64">Requester</TableHead>
                    <TableHead className="w-24 text-right">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} onOpen={openTicket} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loadingTickets && !error && pagination.totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Previous
                </Button>
                {pages.map((page, index) =>
                  page === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={page === pagination.page ? "secondary" : "ghost"}
                      size="icon-sm"
                      className="tabular-nums"
                      onClick={() => setPage(page)}
                    >
                      {page}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  )
}
