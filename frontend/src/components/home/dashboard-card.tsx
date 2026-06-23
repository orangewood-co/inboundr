import type { ComponentType, ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type IconType = ComponentType<{ className?: string }>

/**
 * Shared surface for every homepage widget. Keeps the card chrome (header,
 * icon, optional "view all" link, body) consistent so the widget registry can
 * compose dashboards without each widget reinventing the shell.
 */
export function DashboardCard({
  title,
  icon: Icon,
  to,
  search,
  viewAllLabel = "View All",
  headerAction,
  children,
  className,
  bodyClassName,
}: {
  title: string
  icon?: IconType
  to?: string
  search?: Record<string, string>
  viewAllLabel?: string
  headerAction?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
          ) : null}
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        {headerAction
          ? headerAction
          : to
            ? (
              <Link
                to={to}
                search={search as never}
                className="group/cta inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {viewAllLabel}
                <ArrowUpRightIcon className="size-3.5 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-x-0 motion-reduce:group-hover/cta:translate-y-0" />
              </Link>
            )
            : null}
      </header>
      <div className={cn("flex flex-1 flex-col p-2", bodyClassName)}>{children}</div>
    </section>
  )
}

/** Shared row container — consistent hover, padding, and focus across widgets. */
export const widgetRowClass =
  "group/row flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Neutral initials avatar used as a row's leading anchor. */
export function WidgetAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
      {getInitials(name)}
    </span>
  )
}

/** Stage-colored chip (soft fill + solid dot) for task rows. */
export function WidgetStageChip({ color }: { color?: string | null }) {
  const c = color || "var(--muted-foreground)"
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `color-mix(in oklab, ${c} 18%, transparent)` }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: c }} />
    </span>
  )
}

/**
 * Trailing chevron that stays transparent (reserving its width to avoid layout
 * shift) and tints on row hover — a quiet "this is clickable" affordance.
 */
export function RowChevron() {
  return (
    <ChevronRightIcon className="size-4 shrink-0 text-transparent transition-colors duration-150 group-hover/row:text-muted-foreground/60" />
  )
}

/** Compact loading rows sized for a widget body (vs the full-page ListSkeleton). */
export function WidgetRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Compact empty state for inside a widget body. */
export function WidgetEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon?: IconType
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 py-10 text-center">
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted/70 ring-1 ring-border/60">
          <Icon className="size-[18px] text-muted-foreground" />
        </span>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

/** Compact inline error for inside a widget body. */
export function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <p className="text-sm font-medium text-destructive">Couldn&apos;t load this</p>
      <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">{message}</p>
    </div>
  )
}
