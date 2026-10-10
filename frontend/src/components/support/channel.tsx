import type { ComponentType, SVGProps } from "react"
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export type ChannelMeta = {
  icon: IconComponent
  label: string
}

/** WhatsApp glyph, drawn to match lucide's 24px grid and stroke weight. */
export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  )
}

const CHANNEL_META: Record<string, ChannelMeta> = {
  phone: { icon: PhoneIcon, label: "Phone call" },
  chat: { icon: MessageCircleIcon, label: "Live chat" },
  whatsapp: { icon: WhatsAppIcon, label: "WhatsApp" },
  email: { icon: MailIcon, label: "Email" },
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
            channel === "whatsapp" && "text-emerald-600 dark:text-emerald-400",
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
      <Icon
        className={cn(
          "size-3.5 text-muted-foreground",
          channel === "whatsapp" && "text-emerald-600 dark:text-emerald-400"
        )}
      />
      <span>{meta.label}</span>
    </span>
  )
}
