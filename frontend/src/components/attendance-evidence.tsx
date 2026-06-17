import { useState } from "react"
import { CameraIcon, DownloadIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

export type EvidenceLocation = {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt?: string
}

function osmUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
}

function osmEmbedUrl(lat: number, lng: number, span = 0.0025) {
  const d = span
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
}

function coordinateLabel(location: EvidenceLocation) {
  const accuracy =
    location.accuracy === null ? "" : ` · ${Math.round(location.accuracy)}m accuracy`
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}`
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "selfie"
  )
}

function extensionFromUrl(url: string) {
  try {
    const { pathname } = new URL(url)
    const match = pathname.match(/\.([a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : "jpg"
  } catch {
    return "jpg"
  }
}

export function SelfieEvidence({
  src,
  title,
  subtitle,
}: {
  src: string
  title: string
  subtitle?: string
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error("Request failed")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = `${slugify(title)}-selfie.${extensionFromUrl(src)}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(src, "_blank", "noopener,noreferrer")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
            <CameraIcon />
            Selfie
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64 p-2">
          <img
            src={src}
            alt={title}
            loading="lazy"
            className="max-h-56 w-full rounded-md object-contain"
          />
        </HoverCardContent>
      </HoverCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </DialogHeader>
          <img
            src={src}
            alt={title}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => void handleDownload()}
            disabled={downloading}
          >
            <DownloadIcon />
            {downloading ? "Downloading..." : "Download"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LocationEvidence({
  location,
  title,
  subtitle,
}: {
  location: EvidenceLocation
  title: string
  subtitle?: string
}) {
  const [open, setOpen] = useState(false)
  const { latitude, longitude } = location

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
            <MapPinIcon />
            Map
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72 p-2">
          <div className="overflow-hidden rounded-md border">
            <iframe
              title="Location preview"
              width="100%"
              height="160"
              src={osmEmbedUrl(latitude, longitude)}
              className="border-0"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{coordinateLabel(location)}</p>
        </HoverCardContent>
      </HoverCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border">
            <iframe
              title="Location map"
              width="100%"
              height="360"
              src={osmEmbedUrl(latitude, longitude, 0.005)}
              className="border-0"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{coordinateLabel(location)}</p>
            <a
              href={osmUrl(latitude, longitude)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon className="size-3" />
              Open in OpenStreetMap
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
