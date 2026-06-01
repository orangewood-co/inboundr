import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowUpRightIcon,
  FileTextIcon,
  InboxIcon,
  PackageIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/lib/auth-client"
import { useEntitlements, type EmployeeAccessModule, type FeatureKey } from "@/lib/entitlements"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

interface StatsOverview {
  totals: {
    emails: number
    rfqs: number
    nonRfqs: number
    products: number
    failed: number
  }
}

type ModuleTile = {
  title: string
  url: string
  icon: typeof FileTextIcon
  feature?: FeatureKey
  module?: EmployeeAccessModule
}

const moduleTiles: ModuleTile[] = [
  { title: "RFQ", url: "/rfq", icon: FileTextIcon, feature: "rfq", module: "rfq" },
  { title: "Inbox", url: "/emails", icon: InboxIcon, module: "inbox" },
  { title: "Orders", url: "/orders", icon: ShoppingCartIcon },
  { title: "Products", url: "/products", icon: PackageIcon, module: "products" },
  { title: "Invoices", url: "/invoices", icon: ReceiptTextIcon, feature: "invoices", module: "invoices" },
  { title: "Customers", url: "/customers", icon: UsersIcon, module: "customers" },
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const { data: session } = useSession()
  const { hasFeature, hasModuleAccess } = useEntitlements()
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res = await fetch(`${API_ORIGIN}/api/v1/stats/overview?range=7d`, {
      credentials: "include",
    })
    if (res.ok) {
      setStats(await res.json())
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const userName = session?.user?.name?.split(" ")[0] ?? "there"

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const visibleTiles = moduleTiles.filter((tile) => {
    if (tile.feature && !hasFeature(tile.feature)) return false
    if (tile.module && !hasModuleAccess(tile.module)) return false
    return true
  })

  return (
    <AppLayout>
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-6">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Header */}
            <section className="animate-in fade-in-0 slide-in-from-bottom-1 duration-400">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {todayFormatted}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
                {getGreeting()}, {userName}
              </h1>
            </section>

            {/* Slim stat row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="RFQs this week"
                value={stats?.totals.rfqs ?? 0}
                hint={`${stats?.totals.emails ?? 0} emails processed`}
                delay="80ms"
              />
              <StatCard
                label="Products Requested"
                value={stats?.totals.products ?? 0}
                hint="Line items from RFQs"
                delay="140ms"
              />
            </div>

            {/* Module launcher */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Modules</h2>
              </div>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {visibleTiles.map((tile, i) => (
                  <ModuleCard key={tile.url} tile={tile} delay={`${200 + i * 60}ms`} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  )
}

function StatCard({
  label,
  value,
  hint,
  delay,
}: {
  label: string
  value: number
  hint: string
  delay: string
}) {
  return (
    <div
      className="rounded-2xl border bg-card p-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
      style={{ animationDelay: delay, animationFillMode: "backwards" } as CSSProperties}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function ModuleCard({ tile, delay }: { tile: ModuleTile; delay: string }) {
  const Icon = tile.icon
  return (
    <Link
      to={tile.url}
      className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-8 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-400"
      style={{ animationDelay: delay, animationFillMode: "backwards" } as CSSProperties}
    >
      <ArrowUpRightIcon className="absolute right-3 top-3 size-3.5 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground/60" />
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted/70 transition-colors group-hover:bg-muted">
        <Icon className="size-6 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <span className="text-sm font-medium">{tile.title}</span>
    </Link>
  )
}

export default HomePage
