import { CopyIcon, ExternalLinkIcon, LinkIcon, PhoneIcon, RefreshCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { copyToClipboard } from "@/lib/utils"
import { useSupport } from "./support-provider"
import { useAssignedPhoneNumbers, type AssignedPhoneNumber } from "./use-assigned-phone-numbers"
import { SupportViewToggle } from "./view-toggle"

export function ChatWidgetLink({ link }: { link: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LinkIcon />
          Chat Link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium">Public Chat Link</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this URL so visitors can start a support chat. To add a chat bubble to your website,
          copy the snippet from Settings → Support.
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

function PhoneNumberRow({ number }: { number: AssignedPhoneNumber }) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs text-foreground">
        {number.phoneNumber}
        {number.label ? ` · ${number.label}` : ""}
      </code>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Copy phone number"
        onClick={() => copyToClipboard(number.phoneNumber, "Phone number copied")}
      >
        <CopyIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" asChild>
        <a href={`tel:${number.phoneNumber}`} aria-label="Call number">
          <PhoneIcon />
        </a>
      </Button>
    </div>
  )
}

/** Shown in the site header's leading slot on every support surface.
 * Renders nothing while realtime is connected; only surfaces a warning
 * when the connection is down. */
export function RealtimeIndicator() {
  const { socketReady } = useSupport()
  if (socketReady) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-label="Realtime not connected"
          className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
          Not connected
        </span>
      </TooltipTrigger>
      <TooltipContent>Live updates are paused while reconnecting</TooltipContent>
    </Tooltip>
  )
}

/** One shared set of header actions so the top bar never changes while moving
 * between the list, a conversation, and the panes/table views. */
export function SupportHeaderActions() {
  const inbox = useSupport()
  const assignedPhoneNumbers = useAssignedPhoneNumbers()

  return (
    <>
      <PhoneNumberButton numbers={assignedPhoneNumbers} />
      {inbox.supportChatLink ? <ChatWidgetLink link={inbox.supportChatLink} /> : null}
      <SupportViewToggle />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Refresh conversations"
            onClick={() => void inbox.refresh()}
          >
            <RefreshCcwIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
    </>
  )
}

export function PhoneNumberButton({ numbers }: { numbers: AssignedPhoneNumber[] }) {
  if (numbers.length === 0) return null
  const label =
    numbers.length === 1 ? numbers[0].phoneNumber : `${numbers.length} numbers`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PhoneIcon />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium">Voice Support Number</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {numbers.length === 1
            ? "Customers reach your voice agent by calling this number."
            : "Customers reach your voice agent by calling these numbers."}
        </p>
        <div className="mt-3 space-y-2">
          {numbers.map((number) => (
            <PhoneNumberRow key={number.id} number={number} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
