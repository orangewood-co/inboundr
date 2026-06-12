import type { ComponentType, ReactNode } from "react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Canonical page title block for centered content pages
 * (forms, links, stats, settings, admin, detail pages...).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/**
 * Canonical border-b toolbar for full-bleed list workspaces
 * (customers, invoices, products, drive, orders...).
 */
export function PageToolbar({
  leading,
  icon: Icon,
  title,
  count,
  actions,
  className,
  children,
}: {
  leading?: ReactNode
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  count?: number | null
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3", className)}>
      <div className="flex items-center gap-2">
        {leading}
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
        {count != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
            {formatNumber(count)}
          </span>
        )}
        {children}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
