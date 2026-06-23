import type { ComponentType } from "react"

import type { EmployeeAccessModule, FeatureKey } from "@/lib/entitlements"

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
