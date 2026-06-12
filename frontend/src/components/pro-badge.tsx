import { cn } from "@/lib/utils"

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[5px] bg-amber-400 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-amber-950",
        className
      )}
    >
      Pro
    </span>
  )
}
