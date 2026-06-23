import type { CSSProperties } from "react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import {
  DEFAULT_DASHBOARD_LAYOUT,
  WIDGET_SIZE_CLASS,
} from "@/components/home/widget-registry"
import { useSession } from "@/lib/auth-client"
import { useEntitlements } from "@/lib/entitlements"
import { cn } from "@/lib/utils"

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function HomePage() {
  const { data: session } = useSession()
  const { hasFeature, hasModuleAccess } = useEntitlements()

  const userName = session?.user?.name?.split(" ")[0] ?? "there"
  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const widgets = DEFAULT_DASHBOARD_LAYOUT.filter((widget) => {
    if (widget.feature && !hasFeature(widget.feature)) return false
    if (widget.module && !hasModuleAccess(widget.module)) return false
    return true
  })

  return (
    <AppLayout>
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-6">
        <section className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out motion-reduce:animate-none">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {todayFormatted}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
            {getGreeting()}, {userName}
          </h1>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {widgets.map((widget, i) => {
            const Widget = widget.Component
            return (
              <div
                key={widget.id}
                className={cn(
                  "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none",
                  WIDGET_SIZE_CLASS[widget.size]
                )}
                style={
                  { animationDelay: `${80 + i * 60}ms`, animationFillMode: "backwards" } as CSSProperties
                }
              >
                <Widget />
              </div>
            )
          })}
        </div>
      </main>
    </AppLayout>
  )
}

export default HomePage
