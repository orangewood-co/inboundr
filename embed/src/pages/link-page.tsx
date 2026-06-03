import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircleIcon, LoaderIcon, LockIcon, MapPinIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ORIGIN } from "@/lib/env"

type LinkCheck = {
  code: string
  title: string | null
  requiresPassword: boolean
  requiresPreciseLocation: boolean
}

export default function LinkPage({ code }: { code: string }) {
  const [link, setLink] = useState<LinkCheck | null>(null)
  const [password, setPassword] = useState("")
  const [passwordAccepted, setPasswordAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const source = useMemo(() => new URLSearchParams(window.location.search).get("source"), [])
  const linkApiUrl = useCallback(
    (suffix = "") => {
      const url = new URL(`/l/${code}${suffix}`, API_ORIGIN)
      if (source) url.searchParams.set("source", source)
      return url.toString()
    },
    [code, source]
  )

  useEffect(() => {
    fetch(linkApiUrl("/check"))
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (response.ok) return body
        const reason = body?.result === "expired"
          ? "This link has expired."
          : body?.result === "view_limit_reached"
            ? "This link has reached its view limit."
            : body?.error || "This link is not available"
        throw new Error(reason)
      })
      .then((data: LinkCheck) => {
        setLink(data)
        if (!data.requiresPassword && !data.requiresPreciseLocation) {
          window.location.href = linkApiUrl()
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "This link is not available"))
      .finally(() => setLoading(false))
  }, [linkApiUrl])

  async function unlock(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setWorking(true)
    setError(null)
    try {
      const response = await fetch(linkApiUrl("/unlock"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Unable to open link")
      if (body.destinationUrl) {
        window.location.href = body.destinationUrl
        return
      }
      setPasswordAccepted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open link")
    } finally {
      setWorking(false)
    }
  }

  async function requestLocation() {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser")
      return
    }
    setWorking(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(linkApiUrl("/track-location"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          })
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body?.error ?? "Unable to open link")
          window.location.href = body.destinationUrl
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to open link")
          setWorking(false)
        }
      },
      () => {
        setError("Location permission was denied")
        setWorking(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const needsPassword = link?.requiresPassword && !passwordAccepted
  const needsLocation = link?.requiresPreciseLocation && (!link.requiresPassword || passwordAccepted)

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-2xl shadow-stone-900/10">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoaderIcon className="size-4 animate-spin" />
            Checking link...
          </div>
        ) : error && !link ? (
          <div className="text-center">
            <AlertCircleIcon className="mx-auto size-8 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-stone-900">Link unavailable</h1>
            <p className="mt-2 text-sm text-stone-500">{error}</p>
          </div>
        ) : needsPassword ? (
          <form onSubmit={unlock} className="grid gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <LockIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{link?.title || "Protected link"}</h1>
              <p className="mt-1 text-sm text-stone-500">Enter the password to continue.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={working}>
              {working && <LoaderIcon className="size-4 animate-spin" />}
              Continue
            </Button>
          </form>
        ) : needsLocation ? (
          <div className="grid gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <MapPinIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{link?.title || "Location request"}</h1>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                This link requests precise location tracking before redirecting. Your browser will ask for permission.
              </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={() => void requestLocation()} disabled={working}>
              {working && <LoaderIcon className="size-4 animate-spin" />}
              Share location and continue
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoaderIcon className="size-4 animate-spin" />
            Opening link...
          </div>
        )}
      </div>
    </main>
  )
}
