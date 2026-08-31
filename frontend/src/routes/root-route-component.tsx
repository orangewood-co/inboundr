import { useEffect } from "react"
import { Outlet, useRouterState } from "@tanstack/react-router"

import { PostHogAnalytics } from "@/lib/posthog"
import { documentTitleForPath } from "@/lib/route-meta"
import { setTabBaseTitle } from "@/lib/tab-indicator"

export function RootRouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    setTabBaseTitle(documentTitleForPath(pathname))
  }, [pathname])

  return (
    <>
      <PostHogAnalytics />
      <Outlet />
    </>
  )
}
