import { useEffect, useRef } from "react"
import { useRouterState } from "@tanstack/react-router"
import { usePostHog } from "@posthog/react"

import { useSession } from "@/lib/auth-client"
import { POSTHOG_ENABLED } from "@/lib/env"

export function PostHogAnalytics() {
  const posthog = usePostHog()
  const { data: session, isPending } = useSession()
  const href = useRouterState({
    select: (state) => state.location.href,
  })
  const identifiedUserIdRef = useRef<string | null>(null)
  const skippedInitialPageviewRef = useRef(false)
  const user = session?.user

  useEffect(() => {
    if (!POSTHOG_ENABLED || !posthog || isPending) return

    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      })
      identifiedUserIdRef.current = user.id
      return
    }

    if (identifiedUserIdRef.current) {
      posthog.reset()
      identifiedUserIdRef.current = null
    }
  }, [isPending, posthog, user?.email, user?.id, user?.name])

  useEffect(() => {
    if (!POSTHOG_ENABLED || !posthog) return

    if (!skippedInitialPageviewRef.current) {
      skippedInitialPageviewRef.current = true
      return
    }

    posthog.capture("$pageview", {
      $current_url: new URL(href, window.location.origin).toString(),
    })
  }, [href, posthog])

  return null
}
