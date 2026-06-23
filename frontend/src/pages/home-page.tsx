import { useCallback, useEffect, useMemo, useState } from "react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { DashboardGrid } from "@/components/home/dashboard-grid"
import { resolveLayout } from "@/components/home/widget-registry"
import { useSession } from "@/lib/auth-client"
import { useEntitlements } from "@/lib/entitlements"
import {
  getCachedHomeLayout,
  getHomeLayout,
  saveHomeLayout,
  setCachedHomeLayout,
  type HomeLayoutItem,
} from "@/lib/home-layout"

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function HomePage() {
  const { data: session } = useSession()
  const { hasFeature, hasModuleAccess } = useEntitlements()
  const userId = session?.user?.id
  const [saved, setSaved] = useState<HomeLayoutItem[] | null>(null)

  useEffect(() => {
    if (!userId) return
    const cached = getCachedHomeLayout(userId)
    if (cached) setSaved(cached)

    let active = true
    getHomeLayout()
      .then((items) => {
        if (!active) return
        setSaved(items)
        setCachedHomeLayout(userId, items)
      })
      .catch(() => {
        // keep cache/default on failure
      })
    return () => {
      active = false
    }
  }, [userId])

  const resolved = useMemo(
    () => resolveLayout(saved, { hasFeature, hasModuleAccess }),
    [saved, hasFeature, hasModuleAccess]
  )

  const onPersist = useCallback(
    async (items: HomeLayoutItem[]) => {
      const next = await saveHomeLayout(items)
      setSaved(next)
      if (userId) setCachedHomeLayout(userId, next)
    },
    [userId]
  )

  const userName = session?.user?.name?.split(" ")[0] ?? "there"
  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const heading = (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out motion-reduce:animate-none">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {todayFormatted}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">
        {getGreeting()}, {userName}
      </h1>
    </div>
  )

  return (
    <AppLayout>
      <SiteHeader />
      <main className="flex flex-1 flex-col overflow-auto p-4 lg:px-6 lg:py-6">
        <DashboardGrid heading={heading} resolved={resolved} onPersist={onPersist} />
      </main>
    </AppLayout>
  )
}

export default HomePage
