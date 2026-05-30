import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { toCanvas } from "qrcode"
import {
  ArrowLeftIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  LinkIcon,
  LoaderIcon,
  LockIcon,
  MapPinIcon,
  Maximize2Icon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const EVENT_LABELS: Record<string, string> = {
  redirected: "Opened",
  password_required: "Password Required",
  password_failed: "Password Failed",
  precise_location_required: "Location Requested",
  expired: "Expired",
  view_limit_reached: "Limit Reached",
}

function eventLabel(result: string) {
  return EVENT_LABELS[result] ?? result.replace(/_/g, " ")
}

function formatLocation(event: LinkEvent) {
  const parts = [
    event.approximateLocation.city,
    event.approximateLocation.region,
    event.approximateLocation.country,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

function osmUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
}

function osmEmbedUrl(lat: number, lng: number) {
  const d = 0.01
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
}

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
  createdAt: string
}

type LinkEvent = {
  _id: string
  openedAt: string
  result: string
  referrer: string | null
  userAgent: { browser: string | null; os: string | null; device: string | null }
  approximateLocation: { country: string | null; region: string | null; city: string | null }
  preciseLocation: { latitude: number | null; longitude: number | null; accuracy: number | null }
}

function shortUrl(code: string) {
  return `${API_ORIGIN}/l/${code}`
}

function qrShortUrl(code: string) {
  const url = new URL(shortUrl(code))
  url.searchParams.set("source", "qr")
  return url.toString()
}

function filenameSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

function faviconUrl(destinationUrl: string) {
  const domain = extractDomain(destinationUrl)
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ""
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const chartConfig = {
  engagements: {
    label: "Engagements",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export default function LinksDetailPage() {
  const { id } = useParams({ from: "/links/$id" })
  const [link, setLink] = useState<ShortLink | null>(null)
  const [events, setEvents] = useState<LinkEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)

  const fetchLink = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${id}`, { credentials: "include" })
      if (!response.ok) throw new Error("Link not found")
      const data = await response.json()
      setLink(data)
    } catch {
      setError("Failed to load link")
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/${id}/events?limit=250`, {
        credentials: "include",
      })
      if (!response.ok) return
      const data = (await response.json()) as { events: LinkEvent[] }
      setEvents(data.events)
    } catch {
      // non-critical
    }
  }, [id])

  useEffect(() => {
    void fetchLink()
    void fetchEvents()
  }, [fetchLink, fetchEvents])

  const renderQrCanvas = useCallback((canvas: HTMLCanvasElement | null, width: number) => {
    if (!link || !canvas) return
    void toCanvas(canvas, qrShortUrl(link.code), {
      errorCorrectionLevel: "M",
      margin: 2,
      width,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then(() => {
        canvas.style.width = "100%"
        canvas.style.height = "100%"
      })
      .catch(() => toast.error("Unable to generate QR code"))
  }, [link])

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000

    const redirected = events.filter((e) => e.result === "redirected")
    const last7 = redirected.filter((e) => new Date(e.openedAt).getTime() >= weekAgo)
    const prev7 = redirected.filter(
      (e) => {
        const t = new Date(e.openedAt).getTime()
        return t >= twoWeeksAgo && t < weekAgo
      },
    )

    let weeklyChange = 0
    if (prev7.length > 0) {
      weeklyChange = Math.round(((last7.length - prev7.length) / prev7.length) * 100)
    } else if (last7.length > 0) {
      weeklyChange = 100
    }

    return {
      total: link?.viewCount ?? 0,
      last7: last7.length,
      weeklyChange,
    }
  }, [events, link])

  const chartData = useMemo(() => {
    const redirected = events.filter((e) => e.result === "redirected")
    if (redirected.length === 0) return []

    const buckets = new Map<string, number>()

    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      buckets.set(key, 0)
    }

    for (const e of redirected) {
      const key = new Date(e.openedAt).toISOString().slice(0, 10)
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }
    }

    return Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      engagements: count,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }))
  }, [events])

  const recentEvents = useMemo(() => events.slice(0, 20), [events])

  const preciseLocations = useMemo(
    () => events.filter((e) => e.preciseLocation.latitude != null && e.preciseLocation.longitude != null),
    [events],
  )
  const latestPrecise = preciseLocations[0] ?? null

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(shortUrl(link.code))
    toast.success("Short link copied")
  }

  async function archiveLink() {
    if (!link) return
    await fetch(`${API_BASE}/${link._id}`, { method: "DELETE", credentials: "include" })
    toast.success("Link archived")
    window.history.back()
  }

  async function downloadQrCode() {
    if (!link) return
    const canvas = document.createElement("canvas")
    await toCanvas(canvas, qrShortUrl(link.code), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1024,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
    const name = filenameSlug(link.title || extractDomain(link.destinationUrl) || link.code) || link.code
    const anchor = document.createElement("a")
    anchor.href = canvas.toDataURL("image/png")
    anchor.download = `${name}-qr.png`
    anchor.click()
  }

  if (loading) {
    return (
      <AppLayout>
          <SiteHeader breadcrumbs={[{ label: "Links", href: "/links" }, { label: "Details" }]} />
          <main className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" />
              Loading link...
            </div>
          </main>
      </AppLayout>
    )
  }

  if (error || !link) {
    return (
      <AppLayout>
          <SiteHeader breadcrumbs={[{ label: "Links", href: "/links" }, { label: "Details" }]} />
          <main className="flex flex-1 flex-col items-center justify-center gap-3">
            <LinkIcon className="size-10 text-muted-foreground" />
            <p className="font-semibold">Link not found</p>
            <Button variant="outline" asChild>
              <Link to="/links">
                <ArrowLeftIcon className="size-4" />
                Back to links
              </Link>
            </Button>
          </main>
      </AppLayout>
    )
  }

  const favicon = faviconUrl(link.destinationUrl)

  return (
    <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Links", href: "/links" },
            { label: link.title || link.code },
          ]}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            {/* Back link */}
            <Link
              to="/links"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back to list
            </Link>

            {/* Link header card */}
            <div className="mt-4 rounded-xl border bg-card p-6">
              <div className="flex items-start gap-4">
                {/* Favicon */}
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                  {favicon ? (
                    <img
                      src={favicon}
                      alt=""
                      className="size-7"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = "none"
                        ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden")
                      }}
                    />
                  ) : null}
                  <LinkIcon className={`size-5 text-muted-foreground ${favicon ? "hidden" : ""}`} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">
                      {link.title || `${extractDomain(link.destinationUrl)} – untitled`}
                    </h1>
                    {link.hasPassword && (
                      <Tooltip>
                        <TooltipTrigger>
                          <LockIcon className="size-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Password protected</TooltipContent>
                      </Tooltip>
                    )}
                    {link.trackingMode === "precise_location" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <MapPinIcon className="size-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Precise location tracking</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => void copyLink()}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {shortUrl(link.code).replace(/^https?:\/\//, "")}
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => void copyLink()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <CopyIcon className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copy link</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ExternalLinkIcon className="size-4 shrink-0" />
                    <a
                      href={link.destinationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:underline"
                    >
                      {link.destinationUrl}
                    </a>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(link.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      {link.expiresAt && (
                        <Badge variant="secondary" className="text-xs">
                          Expires {formatShortDate(link.expiresAt)}
                        </Badge>
                      )}
                      {link.maxViews && (
                        <Badge variant="secondary" className="text-xs">
                          Limit: {link.maxViews}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9">
                        <EllipsisIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={() => void copyLink()}>
                        <CopyIcon className="size-4" />
                        <span>Copy short link</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(link.destinationUrl, "_blank")}>
                        <ExternalLinkIcon className="size-4" />
                        <span>Open destination</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void archiveLink()} className="text-destructive">
                        <Trash2Icon className="size-4" />
                        <span>Archive</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" onClick={() => void copyLink()}>
                    <ShareIcon className="size-4" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-5">
                <p className="text-sm font-medium text-muted-foreground">Engagements</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{stats.total}</p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{stats.last7}</p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <p className="text-sm font-medium text-muted-foreground">Weekly Change</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${stats.weeklyChange > 0 ? "text-green-600" : stats.weeklyChange < 0 ? "text-red-500" : ""}`}>
                  {stats.weeklyChange > 0 ? "+" : ""}{stats.weeklyChange}%
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-4">
              <div className="w-fit rounded-xl border bg-card p-6">
                <h2 className="text-lg font-semibold">QR Code</h2>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
                    <canvas
                      ref={(canvas) => renderQrCanvas(canvas, 240)}
                      aria-label={`QR code for ${shortUrl(link.code)}`}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => setQrOpen(true)}>
                          <Maximize2Icon className="size-4" />
                          <span className="sr-only">Expand QR code</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Expand</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => void downloadQrCode()}>
                          <DownloadIcon className="size-4" />
                          <span className="sr-only">Download QR code PNG</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download PNG</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Scans open the tracked short link.</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h2 className="text-lg font-semibold">Link Performance</h2>
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Events</span>
                    <span className="font-medium">{events.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Successful Redirects</span>
                    <span className="font-medium">{events.filter((e) => e.result === "redirected").length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Password Attempts</span>
                    <span className="font-medium">{events.filter((e) => e.result === "password_required" || e.result === "password_failed").length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Blocked (Expired/Limit)</span>
                    <span className="font-medium">{events.filter((e) => e.result === "expired" || e.result === "view_limit_reached").length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagements over time chart */}
            <div className="mt-4 rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Engagements over time</h2>
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </div>
              {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-64 w-full">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="fillEngagements" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-engagements)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-engagements)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      dataKey="engagements"
                      type="monotone"
                      fill="url(#fillEngagements)"
                      stroke="var(--color-engagements)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="mt-4 flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No engagement data yet
                </div>
              )}
            </div>

            {/* Precise location map */}
            {latestPrecise && latestPrecise.preciseLocation.latitude != null && latestPrecise.preciseLocation.longitude != null && (
              <div className="mt-4 rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Location Map</h2>
                  <a
                    href={osmUrl(latestPrecise.preciseLocation.latitude, latestPrecise.preciseLocation.longitude!)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLinkIcon className="size-3" />
                    Open in OpenStreetMap
                  </a>
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border">
                  <iframe
                    title="Location map"
                    width="100%"
                    height="300"
                    src={osmEmbedUrl(latestPrecise.preciseLocation.latitude, latestPrecise.preciseLocation.longitude!)}
                    className="border-0"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the most recent precise location from {formatDate(latestPrecise.openedAt)}
                </p>
              </div>
            )}

            {/* Recent Events */}
            <div className="mt-4 rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Recent Events</h2>
              {recentEvents.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-36">Status</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentEvents.map((event) => {
                        const location = formatLocation(event)
                        const hasPrecise = event.preciseLocation.latitude != null && event.preciseLocation.longitude != null

                        return (
                          <TableRow key={event._id}>
                            <TableCell>
                              <Badge
                                variant={event.result === "redirected" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {eventLabel(event.result)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {[event.userAgent.browser, event.userAgent.os, event.userAgent.device]
                                .filter(Boolean)
                                .join(" / ") || "Unknown device"}
                            </TableCell>
                            <TableCell>
                              {location && (
                                <span className="text-sm">{location}</span>
                              )}
                              {hasPrecise && (
                                <a
                                  href={osmUrl(event.preciseLocation.latitude!, event.preciseLocation.longitude!)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <MapPinIcon className="size-3" />
                                  View on map
                                </a>
                              )}
                              {!location && !hasPrecise && (
                                <span className="text-sm text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(event.openedAt)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{link.title || "QR Code"}</DialogTitle>
                  <DialogDescription>Scan this QR code to open the tracked short link.</DialogDescription>
                </DialogHeader>
                <div className="mx-auto flex w-full max-w-[min(70vh,560px)] items-center justify-center overflow-hidden rounded-xl border bg-white p-4">
                  <canvas
                    ref={(canvas) => renderQrCanvas(canvas, 640)}
                    aria-label={`Expanded QR code for ${shortUrl(link.code)}`}
                    className="aspect-square h-auto w-full"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => void downloadQrCode()}>
                    <DownloadIcon className="size-4" />
                    Download PNG
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </main>
    </AppLayout>
  )
}
