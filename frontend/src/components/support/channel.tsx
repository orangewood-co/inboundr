import { MessageCircleIcon, PhoneIcon, type LucideIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type ChannelMeta = {
  icon: LucideIcon
  label: string
}

const CHANNEL_META: Record<string, ChannelMeta> = {
  phone: { icon: PhoneIcon, label: "Phone call" },
  chat: { icon: MessageCircleIcon, label: "Live chat" },
}

export function getChannelMeta(channel: string | null | undefined): ChannelMeta {
  return CHANNEL_META[channel ?? ""] ?? CHANNEL_META.chat
}

/** Small channel icon with an explanatory tooltip, for dense rows. */
export function ChannelIcon({
  channel,
  className,
}: {
  channel: string | null | undefined
  className?: string
}) {
  const meta = getChannelMeta(channel)
  const Icon = meta.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
            className
          )}
          aria-label={meta.label}
        >
          <Icon className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{meta.label}</TooltipContent>
    </Tooltip>
  )
}

/** Icon + label pill, for detail surfaces like the context panel. */
export function ChannelBadge({
  channel,
  className,
}: {
  channel: string | null | undefined
  className?: string
}) {
  const meta = getChannelMeta(channel)
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className="size-3.5 text-muted-foreground" />
      <span>{meta.label}</span>
    </span>
  )
}
