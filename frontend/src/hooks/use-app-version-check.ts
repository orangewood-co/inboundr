import { useEffect, useRef } from "react"
import { toast } from "sonner"

type VersionManifest = {
  version?: string
}

const VERSION_MANIFEST_URL = "/version.json"
const VERSION_CHECK_INTERVAL_MS = 60_000
const UPDATE_TOAST_ID = "app-version-update"

async function fetchAppVersion(signal?: AbortSignal) {
  const response = await fetch(`${VERSION_MANIFEST_URL}?t=${Date.now()}`, {
    cache: "no-store",
    signal,
  })

  if (!response.ok) {
    return null
  }

  const manifest = (await response.json()) as VersionManifest
  return manifest.version ?? null
}

export function useAppVersionCheck() {
  const currentVersionRef = useRef<string | null>(null)
  const updateShownRef = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV) {
      return
    }

    const abortController = new AbortController()

    async function checkForUpdate() {
      try {
        const latestVersion = await fetchAppVersion(abortController.signal)

        if (!latestVersion) {
          return
        }

        if (!currentVersionRef.current) {
          currentVersionRef.current = latestVersion
          return
        }

        if (
          latestVersion !== currentVersionRef.current &&
          !updateShownRef.current
        ) {
          updateShownRef.current = true

          toast.info("New Version Available", {
            id: UPDATE_TOAST_ID,
            description: "Reload to use the latest version of the app.",
            duration: Infinity,
            action: {
              label: "Reload",
              onClick: () => window.location.reload(),
            },
          })
        }
      } catch {
        // Ignore transient network errors; the next interval or visibility change will retry.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkForUpdate()
      }
    }

    void checkForUpdate()

    const intervalId = window.setInterval(
      checkForUpdate,
      VERSION_CHECK_INTERVAL_MS
    )

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      abortController.abort()
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])
}
