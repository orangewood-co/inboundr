import type { ComponentType, ReactNode } from "react"
import { AlertCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Canonical empty state: icon circle + title + description + optional CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-12 text-center", className)}>
      {Icon ? (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}

/** Canonical inline error state with a single retry copy variant. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 p-8 text-center", className)}>
      <AlertCircleIcon className="size-5 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      ) : null}
    </div>
  )
}

/** Canonical loading state: skeleton rows shaped like a list/table. */
export function ListSkeleton({
  rows = 8,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  const widths = ["w-28", "w-36", "w-24", "w-20", "w-32", "w-16"]
  return (
    <div className={cn("divide-y", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 px-5 py-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} className={cn("h-4", widths[columnIndex % widths.length])} />
          ))}
        </div>
      ))}
    </div>
  )
}
