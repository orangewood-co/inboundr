import type { ComponentType } from "react"

import type { EmployeeAccessModule, FeatureKey } from "@/lib/entitlements"
import type { HomeLayoutItem } from "@/lib/home-layout"

import { TasksWidget } from "./tasks-widget"
import { NotificationsWidget } from "./notifications-widget"
import { SupportActiveCard } from "./active-card-support"
import { RfqActiveCard } from "./active-card-rfq"
import { InvoicesActiveCard } from "./active-card-invoices"
import { ModuleLauncherWidget } from "./module-launcher-widget"

/**
 * Column span on the homepage's responsive grid (single column below `lg`,
 * three columns at `lg`+).
 */
export type WidgetSize = "full" | "two-thirds" | "third"

export interface DashboardWidgetDef {
  /** Stable id — also the key a future "customize homepage" layout persists. */
  id: string
  size: WidgetSize
  /** Org-level feature gate (hidden when the plan lacks it). */
  feature?: FeatureKey
  /** Employee-level module gate (hidden when the user can't access it). */
  module?: EmployeeAccessModule
  Component: ComponentType
}

/**
 * The default homepage layout. Customization (reorder / show-hide / persistence)
 * can later swap this constant for a per-user array of the same shape.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetDef[] = [
  { id: "tasks", size: "two-thirds", feature: "projects", module: "projects", Component: TasksWidget },
  { id: "notifications", size: "third", Component: NotificationsWidget },
  { id: "support", size: "third", feature: "support", module: "support", Component: SupportActiveCard },
  { id: "rfq", size: "third", feature: "rfq", module: "rfq", Component: RfqActiveCard },
  { id: "invoices", size: "third", feature: "invoices", module: "invoices", Component: InvoicesActiveCard },
  { id: "modules", size: "full", Component: ModuleLauncherWidget },
]

export const WIDGET_SIZE_CLASS: Record<WidgetSize, string> = {
  full: "lg:col-span-3",
  "two-thirds": "lg:col-span-2",
  third: "lg:col-span-1",
}

export interface ResolvedWidget {
  def: DashboardWidgetDef
  hidden: boolean
}

type EntitlementChecks = {
  hasFeature: (feature: FeatureKey) => boolean
  hasModuleAccess: (module: EmployeeAccessModule) => boolean
}

function isEntitled(def: DashboardWidgetDef, { hasFeature, hasModuleAccess }: EntitlementChecks): boolean {
  if (def.feature && !hasFeature(def.feature)) return false
  if (def.module && !hasModuleAccess(def.module)) return false
  return true
}

/**
 * Turn a persisted layout into an ordered list of entitled widgets.
 *
 * - Empty/absent saved layout -> registry default order, all visible.
 * - Saved layout present -> saved order; registry widgets missing from it are
 *   appended as hidden (new widgets stay invisible until the user opts in).
 * - Always filtered by entitlements regardless of what was saved.
 */
export function resolveLayout(
  saved: HomeLayoutItem[] | null,
  checks: EntitlementChecks
): ResolvedWidget[] {
  const byId = new Map(DEFAULT_DASHBOARD_LAYOUT.map((def) => [def.id, def]))

  if (!saved || saved.length === 0) {
    return DEFAULT_DASHBOARD_LAYOUT.filter((def) => isEntitled(def, checks)).map((def) => ({
      def,
      hidden: false,
    }))
  }

  const ordered: ResolvedWidget[] = []
  const seen = new Set<string>()

  for (const item of saved) {
    const def = byId.get(item.id)
    if (!def || seen.has(item.id)) continue
    seen.add(item.id)
    if (!isEntitled(def, checks)) continue
    ordered.push({ def, hidden: item.hidden })
  }

  // New registry widgets the saved layout never knew about: append hidden.
  for (const def of DEFAULT_DASHBOARD_LAYOUT) {
    if (seen.has(def.id)) continue
    if (!isEntitled(def, checks)) continue
    ordered.push({ def, hidden: true })
  }

  return ordered
}

/**
 * True when the arrangement matches the registry default (default order across
 * the entitled subset, nothing hidden). Used to persist an empty array — i.e.
 * "no customization" — so the layout keeps tracking the canonical default.
 */
export function isDefaultLayout(resolved: ResolvedWidget[], checks: EntitlementChecks): boolean {
  const defaultIds = DEFAULT_DASHBOARD_LAYOUT.filter((def) => isEntitled(def, checks)).map(
    (def) => def.id
  )
  if (resolved.length !== defaultIds.length) return false
  return resolved.every(
    (widget, index) => widget.def.id === defaultIds[index] && !widget.hidden
  )
}
