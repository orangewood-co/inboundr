import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SupportTicketTagColor, TicketTag } from "./types"

export const TAG_COLOR_STYLES: Record<SupportTicketTagColor, string> = {
  slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  indigo: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
}

export const SUPPORT_TICKET_TAG_COLORS: SupportTicketTagColor[] = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
]

export const TAG_DOT_STYLES: Record<SupportTicketTagColor, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
}

function colorStyle(color: string): string {
  return TAG_COLOR_STYLES[color as SupportTicketTagColor] ?? TAG_COLOR_STYLES.slate
}

export function TagChip({
  tag,
  onRemove,
  className,
}: {
  tag: TicketTag
  onRemove?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        colorStyle(tag.color),
        className
      )}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="-mr-0.5 shrink-0 rounded-full opacity-70 transition-opacity hover:opacity-100"
          aria-label={`Remove ${tag.name} tag`}
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </span>
  )
}

export function TagChipList({
  tags,
  max,
  className,
}: {
  tags: TicketTag[]
  max?: number
  className?: string
}) {
  if (tags.length === 0) return null
  const visible = max ? tags.slice(0, max) : tags
  const overflow = tags.length - visible.length
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{overflow}
        </span>
      )}
    </span>
  )
}
