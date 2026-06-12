import { useEffect } from "react"
import { Outlet, useRouterState } from "@tanstack/react-router"

import { PostHogAnalytics } from "@/lib/posthog"
import { documentTitleForPath } from "@/lib/route-meta"

export function RootRouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    document.title = documentTitleForPath(pathname)
  }, [pathname])

  return (
    <>
      <PostHogAnalytics />
      <Outlet />
    </>
  )
}
