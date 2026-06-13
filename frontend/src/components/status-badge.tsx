import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Semantic status tones backed by the --success/--warning/--info/--destructive
 * theme tokens, so every status pill in the app shares one color vocabulary.
 */
export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral"

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
}

export function StatusBadge({
  tone = "neutral",
  icon: Icon,
  spin = false,
  className,
  children,
}: {
  tone?: StatusTone
  icon?: ComponentType<{ className?: string }>
  spin?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TONE_CLASSES[tone],
        className
      )}
    >
      {Icon ? <Icon className={cn("size-3", spin && "animate-spin")} /> : null}
      {children}
    </span>
  )
}
