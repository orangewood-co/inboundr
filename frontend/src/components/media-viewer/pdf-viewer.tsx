import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils" 

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]
const READING_WIDTH = 820 
const CONTENT_PADDING_X = 32 

interface PdfViewerProps {
  url: string
  name: string
}

export default function PdfViewer({ url, name }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const [zoom, setZoom] = useState(1)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setContainerWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [prevCurrentPage, setPrevCurrentPage] = useState(currentPage)
  if (currentPage !== prevCurrentPage) {
    setPrevCurrentPage(currentPage)
    setPageInput(String(currentPage))
  }

  useEffect(() => {
    const root = scrollRef.current
    if (!root || numPages === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (mostVisible) {
          const page = Number(
            mostVisible.target.getAttribute("data-page-number")
          )
          if (page) setCurrentPage(page)
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] }
    )

    pageRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [numPages])

  const handleLoadSuccess = useCallback((pdf: { numPages: number }) => {
    pageRefs.current = new Array(pdf.numPages).fill(null)
    setNumPages(pdf.numPages)
    setCurrentPage(1)
    setStatus("ready")
  }, [])

  const handleLoadError = useCallback((error: Error) => {
    setErrorMessage(error.message)
    setStatus("error")
  }, [])

  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return
      const clamped = Math.min(Math.max(page, 1), numPages)
      pageRefs.current[clamped - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    },
    [numPages]
  )

  const commitPageInput = () => {
    const parsed = Number(pageInput)
    if (Number.isFinite(parsed)) goToPage(parsed)
    else setPageInput(String(currentPage))
  }

  const zoomIndex = ZOOM_LEVELS.reduce(
    (closest, level, i) =>
      Math.abs(level - zoom) < Math.abs(ZOOM_LEVELS[closest] - zoom)
        ? i
        : closest,
    0
  )
  const zoomIn = () =>
    setZoom(ZOOM_LEVELS[Math.min(zoomIndex + 1, ZOOM_LEVELS.length - 1)])
  const zoomOut = () => setZoom(ZOOM_LEVELS[Math.max(zoomIndex - 1, 0)])
  const resetZoom = () => setZoom(1)

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const retry = () => {
    setStatus("loading")
    setErrorMessage(null)
    setNumPages(0)
    setReloadKey((k) => k + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (status !== "ready") return
    if ((e.target as HTMLElement).tagName === "INPUT") return
    if (e.key === "ArrowRight") {
      e.preventDefault()
      goToPage(currentPage + 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      goToPage(currentPage - 1)
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault()
      zoomIn()
    } else if (e.key === "-") {
      e.preventDefault()
      zoomOut()
    }
  }

  const availableWidth =
    Math.max(containerWidth - CONTENT_PADDING_X, 0) || READING_WIDTH
  const pageWidth = Math.round(Math.min(availableWidth, READING_WIDTH) * zoom)

  return (
    <div
      className={cn(
        "flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-1 border-b bg-background px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => goToPage(currentPage - 1)}
            disabled={status !== "ready" || currentPage <= 1}
            label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </ToolbarButton>
          <div className="flex items-center gap-1 px-1 text-sm text-muted-foreground">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => e.key === "Enter" && commitPageInput()}
              disabled={status !== "ready"}
              inputMode="numeric"
              aria-label="Page number"
              className="h-7 w-10 rounded-md border bg-background text-center text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            />
            <span>/ {numPages || "–"}</span>
          </div>
          <ToolbarButton
            onClick={() => goToPage(currentPage + 1)}
            disabled={status !== "ready" || currentPage >= numPages}
            label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={zoomOut}
            disabled={status !== "ready" || zoomIndex <= 0}
            label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </ToolbarButton>
          <button
            type="button"
            onClick={resetZoom}
            disabled={status !== "ready"}
            title="Reset zoom to 100%"
            className="min-w-[3.25rem] rounded-md px-1.5 text-center text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarButton
            onClick={zoomIn}
            disabled={status !== "ready" || zoomIndex >= ZOOM_LEVELS.length - 1}
            label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />
        <div>
          <ToolbarButton
            onClick={handleDownload}
            disabled={status !== "ready"}
            label="Download"
          >
            <Download className="h-4 w-4" />
          </ToolbarButton>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            aria-label="Open in new tab"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto bg-muted/40"
      >
        <div className="px-4 py-4">
          <Document
            key={reloadKey}
            file={url}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={<PageSkeleton width={pageWidth} />}
            error={<ErrorState message={errorMessage} onRetry={retry} />}
            className="flex flex-col items-center gap-4"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el
                }}
                data-page-number={i + 1}
                className="overflow-hidden rounded-sm bg-white shadow-sm"
              >
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  loading={<PageSkeleton width={pageWidth} />}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function PageSkeleton({ width }: { width: number }) {
  const safeWidth = width > 0 ? width : READING_WIDTH
  return (
    <div
      className="animate-pulse rounded-sm bg-muted"
      style={{ width: safeWidth, height: safeWidth * 1.294 }}
    />
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string | null
  onRetry: () => void
}) {
  return (
    <div className="flex h-[55svh] w-[min(90vw,500px)] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Couldn&apos;t load this PDF
        </p>
        {message && (
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Try again
      </button>
    </div>
  )
}
