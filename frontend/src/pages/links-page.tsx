import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { CopyIcon, LinkIcon, LoaderIcon, MapPinIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/links`

type ShortLink = {
  _id: string
  code: string
  destinationUrl: string
  title: string | null
  status: "active" | "disabled" | "archived"
  trackingMode: "standard" | "precise_location"
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  hasPassword: boolean
  updatedAt: string
}

type LinkEvent = {
  _id: string
  openedAt: string
  result: string
  referrer: string | null
  userAgent: { browser: string | null; os: string | null; device: string | null }
  preciseLocation: { latitude: number | null; longitude: number | null; accuracy: number | null }
}

function shortUrl(code: string) {
  return `${API_ORIGIN}/l/${code}`
}

function emptyForm() {
  return {
    title: "",
    destinationUrl: "",
    code: "",
    expiresAt: "",
    maxViews: "",
    password: "",
    trackingMode: "standard",
  }
}

function isExpired(link: ShortLink) {
  return Boolean(link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())
}

function isMaxed(link: ShortLink) {
  return typeof link.maxViews === "number" && link.viewCount >= link.maxViews
}

function availabilityLabel(link: ShortLink) {
  if (link.status !== "active") return link.status
  if (isExpired(link)) return "expired"
  if (isMaxed(link)) return "maxed"
  return "active"
}

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [events, setEvents] = useState<LinkEvent[]>([])
  const [selected, setSelected] = useState<ShortLink | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch links")
      const data = (await response.json()) as { links: ShortLink[] }
      setLinks(data.links)
      setSelected((current) => current ? data.links.find((link) => link._id === current._id) ?? null : data.links[0] ?? null)
    } catch {
      toast.error("Failed to load links")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLinks()
  }, [fetchLinks])

  useEffect(() => {
    if (!selected) {
      setEvents([])
      return
    }
    fetch(`${API_BASE}/${selected._id}/events`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { events: LinkEvent[] }) => setEvents(data.events))
      .catch(() => setEvents([]))
  }, [selected])

  const totals = useMemo(() => ({
    views: links.reduce((sum, link) => sum + link.viewCount, 0),
    protected: links.filter((link) => link.hasPassword).length,
    precise: links.filter((link) => link.trackingMode === "precise_location").length,
  }), [links])

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.expiresAt && new Date(form.expiresAt).getTime() <= Date.now()) {
      toast.error("Expiry must be in the future")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          maxViews: form.maxViews ? Number(form.maxViews) : null,
          expiresAt: form.expiresAt || null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to create link")
      toast.success("Short link created")
      setForm(emptyForm())
      await fetchLinks()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link")
    } finally {
      setSaving(false)
    }
  }

  async function archiveLink(link: ShortLink) {
    await fetch(`${API_BASE}/${link._id}`, { method: "DELETE", credentials: "include" })
    toast.success("Link archived")
    void fetchLinks()
  }

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(shortUrl(code))
    toast.success("Short link copied")
  }

  return (
    <SidebarProvider defaultOpen style={{ "--header-height": "4rem", "--sidebar-width": "18rem" } as CSSProperties}>
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader breadcrumbs={[{ label: "Links" }]} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
            <section>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {links.length} links, {totals.views} total views, {totals.protected} protected
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderIcon className="size-4 animate-spin" />
                  Loading links...
                </div>
              ) : links.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed p-10 text-center">
                  <LinkIcon className="mx-auto size-10 text-muted-foreground" />
                  <p className="mt-3 font-semibold">No links yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create a short link to start tracking views.</p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3">
                  {links.map((link) => (
                    <button
                      key={link._id}
                      onClick={() => setSelected(link)}
                      className={`rounded-2xl border bg-card p-4 text-left transition hover:bg-muted/50 ${isExpired(link) || isMaxed(link) ? "opacity-70" : ""} ${selected?._id === link._id ? "ring-2 ring-ring" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{link.title || link.code}</p>
                            <Badge variant={availabilityLabel(link) === "active" ? "default" : "secondary"}>{availabilityLabel(link)}</Badge>
                            {link.hasPassword && <Badge variant="outline">Password</Badge>}
                            {link.trackingMode === "precise_location" && <Badge variant="outline">Precise location</Badge>}
                          </div>
                          <p className="mt-1 truncate text-sm text-primary">{shortUrl(link.code)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{link.destinationUrl}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold">{link.viewCount}</p>
                          <p className="text-xs text-muted-foreground">views</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={isExpired(link) || isMaxed(link)} onClick={(event) => { event.stopPropagation(); void copyLink(link.code) }}>
                          <CopyIcon className="size-4" />
                          Copy
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={(event) => { event.stopPropagation(); void archiveLink(link) }}>
                          <Trash2Icon className="size-4" />
                          Archive
                        </Button>
                        {link.expiresAt && <span className="text-xs text-muted-foreground">{isExpired(link) ? "Expired" : "Expires"} {new Date(link.expiresAt).toLocaleDateString()}</span>}
                        {link.maxViews && <span className="text-xs text-muted-foreground">Limit {link.maxViews}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="mt-6 rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    <h2 className="font-semibold">Recent events</h2>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                    ) : events.slice(0, 12).map((event) => (
                      <div key={event._id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline">{event.result}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(event.openedAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-muted-foreground">
                          {[event.userAgent.browser, event.userAgent.os, event.userAgent.device].filter(Boolean).join(" · ") || "Unknown device"}
                        </p>
                        {event.preciseLocation.latitude && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Location {event.preciseLocation.latitude.toFixed(4)}, {event.preciseLocation.longitude?.toFixed(4)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Create link</h2>
              <form className="mt-4 grid gap-4" onSubmit={submitLink}>
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(event) => setForm((cur) => ({ ...cur, title: event.target.value }))} placeholder="Campaign or customer name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="destination">Destination URL</Label>
                  <Input id="destination" required value={form.destinationUrl} onChange={(event) => setForm((cur) => ({ ...cur, destinationUrl: event.target.value }))} placeholder="https://example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">Custom code</Label>
                  <Input id="code" value={form.code} onChange={(event) => setForm((cur) => ({ ...cur, code: event.target.value }))} placeholder="optional" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="expires">Expiry</Label>
                    <Input id="expires" type="datetime-local" min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={form.expiresAt} onChange={(event) => setForm((cur) => ({ ...cur, expiresAt: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxViews">Max views</Label>
                    <Input id="maxViews" type="number" min={1} value={form.maxViews} onChange={(event) => setForm((cur) => ({ ...cur, maxViews: event.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={(event) => setForm((cur) => ({ ...cur, password: event.target.value }))} placeholder="optional" />
                </div>
                <label className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.trackingMode === "precise_location"}
                    onChange={(event) => setForm((cur) => ({ ...cur, trackingMode: event.target.checked ? "precise_location" : "standard" }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Precise location tracking</span>
                    <span className="block text-xs text-muted-foreground">Viewers will see a consent screen before redirecting.</span>
                  </span>
                </label>
                <Button type="submit" disabled={saving}>
                  {saving ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                  Create link
                </Button>
              </form>
            </aside>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
