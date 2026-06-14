import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  MailIcon,
  MoreVerticalIcon,
  PanelRightIcon,
  RotateCcwIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ContactHoverCard } from "@/components/contact-hover-card"
import { cn, copyToClipboard, getAvatarColor } from "@/lib/utils"
import { initialsFromName } from "./support-utils"
import type { Ticket } from "./types"

export function ConversationHeader({
  ticket,
  notesCount,
  socketReady,
  detailsOpen,
  onToggleDetails,
  onResolveToggle,
}: {
  ticket: Ticket
  notesCount: number
  socketReady: boolean
  detailsOpen: boolean
  onToggleDetails: () => void
  onResolveToggle: () => void
}) {
  const avatar = getAvatarColor(ticket.requester.name)
  const resolved = ticket.status === "resolved"

  return (
    <div className="border-b">
      {ticket.visitorEndedAt && ticket.status === "open" && (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircleIcon className="size-3.5" />
          Visitor ended this chat. Keep it open for follow-up or mark it resolved when done.
        </div>
      )}
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback className={cn("font-semibold", avatar.bg, avatar.text)}>
            {initialsFromName(ticket.requester.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ContactHoverCard
              contact={{ name: ticket.requester.name, email: ticket.requester.email }}
              side="bottom"
            >
              <h2 className="truncate text-[15px] font-semibold leading-tight hover:underline">
                {ticket.requester.name}
              </h2>
            </ContactHoverCard>
            {notesCount > 0 && (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-amber-500/15 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {notesCount} {notesCount === 1 ? "Note" : "Notes"}
              </span>
            )}
            {ticket.customer && (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-500/15 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                {ticket.customer.company || ticket.customer.name}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            <span className="tabular-nums">#{ticket.ticketNumber}</span>
            <span className="px-1">·</span>
            {ticket.requester.email}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={`mailto:${ticket.requester.email}`} aria-label="Email customer">
                <MailIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Email customer</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          variant={resolved ? "outline" : "secondary"}
          size="sm"
          onClick={onResolveToggle}
          disabled={!socketReady}
          className="gap-1.5"
        >
          {resolved ? <RotateCcwIcon /> : <CheckCircle2Icon />}
          {resolved ? "Reopen" : "Resolve"}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={detailsOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={onToggleDetails}
              aria-label="Toggle details"
              aria-pressed={detailsOpen}
            >
              <PanelRightIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{detailsOpen ? "Hide details" : "Show details"}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => copyToClipboard(ticket.requester.email, "Email copied")}>
              <CopyIcon />
              Copy Email Address
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onResolveToggle} disabled={!socketReady}>
              {resolved ? <RotateCcwIcon /> : <CheckCircle2Icon />}
              {resolved ? "Reopen Conversation" : "Mark as Resolved"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    </div>
  )
}
