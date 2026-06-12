import { cn } from "@/lib/utils"

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400",
        className
      )}
    >
      Pro
    </span>
  )
}
