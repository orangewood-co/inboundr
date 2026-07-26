import { useEffect, useRef, useState } from "react"
import { renderAsync } from "docx-preview"
import { ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToolbarButton, ToolbarDivider, ToolbarLink, ViewerSpinner, ViewerErrorState } from "./viewer-toolbar"
import { downloadFile } from "./viewer-utils"

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface DocxViewerProps {
  url: string
  name: string
}

export default function DocxViewer({ url, name }: DocxViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const [prevUrl, setPrevUrl] = useState(url)
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey)
  if (url !== prevUrl || reloadKey !== prevReloadKey) {
    setPrevUrl(url)
    setPrevReloadKey(reloadKey)
    setStatus("loading")
    setErrorMessage(null)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`)
        const blob = await res.blob()
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ""
        await renderAsync(blob, containerRef.current, containerRef.current, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        })
        if (!cancelled) setStatus("ready")
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "This file may not be a valid .docx document")
          setStatus("error")
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [url, reloadKey])

  const zoomIndex = ZOOM_LEVELS.reduce(
    (closest, level, i) => (Math.abs(level - zoom) < Math.abs(ZOOM_LEVELS[closest] - zoom) ? i : closest),
    0
  )
  const zoomIn = () => setZoom(ZOOM_LEVELS[Math.min(zoomIndex + 1, ZOOM_LEVELS.length - 1)])
  const zoomOut = () => setZoom(ZOOM_LEVELS[Math.max(zoomIndex - 1, 0)])

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-end gap-0.5 border-b bg-background px-2 py-1.5">
        <ToolbarButton onClick={zoomOut} disabled={status !== "ready" || zoomIndex <= 0} label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </ToolbarButton>
        <span className="min-w-13 text-center text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <ToolbarButton onClick={zoomIn} disabled={status !== "ready" || zoomIndex >= ZOOM_LEVELS.length - 1} label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => downloadFile(url, name)} label="Download">
          <Download className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarLink href={url} label="Open in new tab">
          <ExternalLink className="h-4 w-4" />
        </ToolbarLink>
      </div>

      <div className="relative flex-1 overflow-auto bg-muted/40">
        {status === "loading" && <ViewerSpinner />}
        {status === "error" && <ViewerErrorState message={errorMessage} onRetry={() => setReloadKey((k) => k + 1)} />}
        <div
          className={cn("origin-top px-4 py-6 transition-opacity", status === "ready" ? "opacity-100" : "opacity-0")}
          style={{ width: `${100 / zoom}%`, transform: `scale(${zoom})` }}
        >
          <div ref={containerRef} className="mx-auto w-fit [&_.docx-wrapper]:bg-transparent [&_section.docx]:mb-4 [&_section.docx]:shadow-sm last:[&_section.docx]:mb-0" />
        </div>
      </div>
    </div>
  )
}
