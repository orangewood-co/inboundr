import type { ComponentType } from "react"
import { Link } from "@tanstack/react-router"
import {
  BarChart3Icon,
  BotMessageSquareIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  FolderKanbanIcon,
  HardDriveIcon,
  IdCardIcon,
  InboxIcon,
  LayoutGridIcon,
  LinkIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react"

import { useEntitlements, type EmployeeAccessModule, type FeatureKey } from "@/lib/entitlements"

import { DashboardCard } from "./dashboard-card"

type LauncherTile = {
  title: string
  url: string
  icon: ComponentType<{ className?: string }>
  feature?: FeatureKey
  module?: EmployeeAccessModule
}

// All sidebar modules except Admin/Settings and the ones that already get a
// dedicated active card (Support, RFQ, Invoices) to avoid duplication.
const launcherTiles: LauncherTile[] = [
  { title: "Inbox", url: "/emails", icon: InboxIcon, feature: "rfq", module: "rfq" },
  { title: "Stats", url: "/stats", icon: BarChart3Icon, feature: "rfq", module: "rfq" },
  { title: "Chat", url: "/chat", icon: BotMessageSquareIcon, feature: "chat", module: "chat" },
  { title: "Products", url: "/products", icon: PackageIcon, feature: "products", module: "products" },
  { title: "Receivables", url: "/receivables", icon: CircleDollarSignIcon, feature: "invoices", module: "invoices" },
  { title: "Customers", url: "/customers", icon: UsersIcon, feature: "customers", module: "customers" },
  { title: "Employees", url: "/employees", icon: IdCardIcon, feature: "employees", module: "employees" },
  { title: "Projects", url: "/projects", icon: FolderKanbanIcon, feature: "projects", module: "projects" },
  { title: "Forms", url: "/forms", icon: ClipboardListIcon, feature: "forms", module: "forms" },
  { title: "Links", url: "/links", icon: LinkIcon, feature: "links", module: "links" },
  { title: "Drive", url: "/drive", icon: HardDriveIcon, feature: "drive", module: "drive" },
]

export function ModuleLauncherWidget() {
  const { hasFeature, hasModuleAccess } = useEntitlements()

  const tiles = launcherTiles.filter((tile) => {
    if (tile.feature && !hasFeature(tile.feature)) return false
    if (tile.module && !hasModuleAccess(tile.module)) return false
    return true
  })

  if (tiles.length === 0) return null

  return (
    <DashboardCard title="Modules" icon={LayoutGridIcon} bodyClassName="p-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.url}
              to={tile.url}
              className="group flex flex-col items-center gap-2 rounded-xl border bg-background/40 px-3 py-4 text-center transition-[transform,background-color,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-muted/50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted/70 transition-colors duration-150 group-hover:bg-muted">
                <Icon className="size-4.5 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" />
              </span>
              <span className="text-xs font-medium">{tile.title}</span>
            </Link>
          )
        })}
      </div>
    </DashboardCard>
  )
}
