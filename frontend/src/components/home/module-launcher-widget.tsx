import type { ComponentType } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowUpRightIcon,
  BarChart3Icon,
  BotMessageSquareIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  FolderKanbanIcon,
  HardDriveIcon,
  IdCardIcon,
  InboxIcon,
  LinkIcon,
  MonitorCogIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react"

import { useEntitlements, type EmployeeAccessModule, type FeatureKey } from "@/lib/entitlements"

type LauncherTile = {
  title: string
  description: string
  url: string
  icon: ComponentType<{ className?: string }>
  feature?: FeatureKey
  module?: EmployeeAccessModule
}

// All sidebar modules except Admin/Settings and the ones that already get a
// dedicated active card (Support, RFQ, Invoices) to avoid duplication.
const launcherTiles: LauncherTile[] = [
  { title: "Inbox", description: "Read and reply to emails", url: "/emails", icon: InboxIcon, feature: "rfq", module: "rfq" },
  { title: "Stats", description: "Dig into your numbers", url: "/stats", icon: BarChart3Icon, feature: "rfq", module: "rfq" },
  { title: "Chat", description: "Message your workspace", url: "/chat", icon: BotMessageSquareIcon, feature: "chat", module: "chat" },
  { title: "Products", description: "Manage your catalog", url: "/products", icon: PackageIcon, feature: "products", module: "products" },
  { title: "Receivables", description: "Track incoming payments", url: "/receivables", icon: CircleDollarSignIcon, feature: "invoices", module: "invoices" },
  { title: "Customers", description: "Manage customer records", url: "/customers", icon: UsersIcon, feature: "customers", module: "customers" },
  { title: "Employees", description: "Manage your team", url: "/employees", icon: IdCardIcon, feature: "employees", module: "employees" },
  { title: "Projects", description: "Plan and track work", url: "/projects", icon: FolderKanbanIcon, feature: "projects", module: "projects" },
  { title: "Assets", description: "Track company equipment", url: "/assets", icon: MonitorCogIcon, feature: "assets", module: "assets" },
  { title: "Forms", description: "Collect structured responses", url: "/forms", icon: ClipboardListIcon, feature: "forms", module: "forms" },
  { title: "Links", description: "Share and shorten links", url: "/links", icon: LinkIcon, feature: "links", module: "links" },
  { title: "Drive", description: "Store and share files", url: "/drive", icon: HardDriveIcon, feature: "drive", module: "drive" },
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Link
            key={tile.url}
            to={tile.url}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-5 text-foreground" />
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tile.title}</p>
                <p className="truncate text-xs text-muted-foreground">{tile.description}</p>
              </div>
              <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
