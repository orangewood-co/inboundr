import { useEffect, useId, useState } from "react"
import { TURNSTILE_SITE_KEY } from "../lib/turnstile-config"

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const reactId = useId()
  const id = `turnstile-${reactId.replace(/:/g, "")}`
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      onToken("")
      return
    }
    let widgetId = ""
    let cancelled = false
    const render = () => {
      if (cancelled || !window.turnstile) return
      widgetId = window.turnstile.render(`#${id}`, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); setUnavailable(true) },
        theme: "light",
      })
    }
    if (window.turnstile) render()
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-careers-turnstile]')
      const script = existing ?? document.createElement("script")
      if (!existing) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        script.async = true
        script.defer = true
        script.dataset.careersTurnstile = "true"
        document.head.appendChild(script)
      }
      script.addEventListener("load", render, { once: true })
      script.addEventListener("error", () => setUnavailable(true), { once: true })
    }
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [id, onToken])

  if (!TURNSTILE_SITE_KEY && import.meta.env.DEV) return <p className="text-xs text-stone-500">Verification is delegated to the local application server.</p>
  if (unavailable || (!TURNSTILE_SITE_KEY && import.meta.env.PROD)) return <p role="alert" className="text-sm text-red-700">Application verification could not load. Check your connection and refresh.</p>
  return <div id={id} className="min-h-[65px]" aria-label="Application verification" />
}
