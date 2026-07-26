import { useEffect, useState, useMemo, useRef } from "react"
import JSZip from "jszip"
import { Download, ExternalLink, File, Folder, Search, FileCode, Eye, ArrowLeft, AlertTriangle } from "lucide-react"
import { ToolbarButton, ToolbarLink, ViewerSpinner, ViewerErrorState, downloadFile } from "./viewer-toolbar"
import { cn } from "@/lib/utils"
import { getComponentForMimeType } from "./file-viewer-dialog"

interface ZipViewerProps {
  url: string
  name: string
}

interface ZipEntry {
  path: string
  name: string
  isDirectory: boolean
  size: number
  date: Date
  rawFile: JSZip.JSZipObject
}

export default function ZipViewer({ url, name }: ZipViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [entries, setEntries] = useState<ZipEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [downloadingEntry, setDownloadingEntry] = useState<string | null>(null)

  const [previewEntry, setPreviewEntry] = useState<ZipEntry | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<"loading" | "ready" | "error">("loading")
  const objectUrlsRef = useRef<Map<string, string>>(new Map())

  const [prevUrl, setPrevUrl] = useState(url)
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey)
  if (url !== prevUrl || reloadKey !== prevReloadKey) {
    setPrevUrl(url)
    setPrevReloadKey(reloadKey)
    setStatus("loading")
    setErrorMessage(null)
    setSearchQuery("")
    setPreviewEntry(null)
    setPreviewUrl(null)
  }

  useEffect(() => {
    const cache = objectUrlsRef.current
    return () => {
      cache.forEach((objUrl) => URL.revokeObjectURL(objUrl))
      cache.clear()
    }
  }, [url, reloadKey])

  useEffect(() => {
    let cancelled = false

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to download zip archive (${res.status})`)
        return res.arrayBuffer()
      })
      .then(async (buffer) => {
        if (cancelled) return
        const zip = await JSZip.loadAsync(buffer)
        const parsedEntries: ZipEntry[] = []

        zip.forEach((relativePath, file) => {
          const pathParts = relativePath.split("/")
          const name = file.dir ? pathParts[pathParts.length - 2] + "/" : pathParts[pathParts.length - 1]

          parsedEntries.push({
            path: relativePath,
            name,
            isDirectory: file.dir,
            size: (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0,
            date: file.date,
            rawFile: file,
          })
        })

        parsedEntries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.path.localeCompare(b.path)
        })

        if (!cancelled) {
          setEntries(parsedEntries)
          setStatus("ready")
        }
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : "Invalid or corrupted zip archive")
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [url, reloadKey])

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter((e) => e.path.toLowerCase().includes(q))
  }, [entries, searchQuery])

  const getEntryObjectUrl = async (entry: ZipEntry) => {
    const cached = objectUrlsRef.current.get(entry.path)
    if (cached) return cached
    const blob = await entry.rawFile.async("blob")
    const objUrl = URL.createObjectURL(blob)
    objectUrlsRef.current.set(entry.path, objUrl)
    return objUrl
  }

  const handleOpenEntry = async (entry: ZipEntry) => {
    if (entry.isDirectory) return
    setPreviewEntry(entry)
    setPreviewStatus("loading")
    setPreviewUrl(null)
    try {
      const objUrl = await getEntryObjectUrl(entry)
      setPreviewUrl(objUrl)
      setPreviewStatus("ready")
    } catch (err) {
      console.error("Error extracting file from ZIP:", err)
      setPreviewStatus("error")
    }
  }

  const closePreview = () => {
    setPreviewEntry(null)
    setPreviewUrl(null)
  }

  const handleDownloadEntry = async (entry: ZipEntry) => {
    if (entry.isDirectory || downloadingEntry) return
    setDownloadingEntry(entry.path)
    try {
      const objUrl = await getEntryObjectUrl(entry)
      const a = document.createElement("a")
      a.href = objUrl
      a.download = entry.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      console.error("Error extracting file from ZIP:", err)
    } finally {
      setDownloadingEntry(null)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const PreviewComponent = useMemo(
    () => (previewEntry ? getComponentForMimeType("", previewEntry.name) : null),
    [previewEntry?.name]
  )

  if (previewEntry) {
    return (
      <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
          <button
            type="button"
            onClick={closePreview}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to archive
          </button>
          <span className="truncate text-sm font-medium text-foreground/90 max-w-xs" title={previewEntry.path}>
            {previewEntry.path}
          </span>
          <ToolbarButton onClick={() => handleDownloadEntry(previewEntry)} label="Download this file">
            <Download className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="relative flex-1 overflow-hidden bg-muted/40">
          {previewStatus === "loading" && <ViewerSpinner />}
          {previewStatus === "error" && (
            <ViewerErrorState message="Couldn't extract this file from the archive" onRetry={() => handleOpenEntry(previewEntry)} />
          )}
          {previewStatus === "ready" && previewUrl && (
            PreviewComponent ? (
              <div className="absolute inset-0">
                <PreviewComponent url={previewUrl} name={previewEntry.name} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No preview available for this file type</p>
                <button
                  type="button"
                  onClick={() => handleDownloadEntry(previewEntry)}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Download className="h-4 w-4" />
                  Download {previewEntry.name}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
        <div className="flex items-center gap-1.5 flex-1">
          {status === "ready" && (
            <div className="relative flex items-center flex-1 max-w-sm">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search files in archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-full rounded-md border bg-background pl-8 pr-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => downloadFile(url, name)} label="Download full zip">
            <Download className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarLink href={url} label="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ToolbarLink>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-background">
        {status === "loading" && <ViewerSpinner />}
        {status === "error" && <ViewerErrorState message={errorMessage} onRetry={() => setReloadKey((k) => k + 1)} />}

        {status === "ready" && (
          <div className="flex flex-col min-w-full">
            <div className="sticky top-0 z-10 grid grid-cols-12 border-b bg-muted/60 px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase select-none">
              <span className="col-span-6 md:col-span-7">Name</span>
              <span className="col-span-3 md:col-span-2 text-right">Size</span>
              <span className="col-span-3 text-right hidden md:inline">Modified</span>
              <span className="col-span-3 md:col-span-2 text-right">Actions</span>
            </div>

            {filteredEntries.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.path}
                    className="grid grid-cols-12 items-center px-4 py-2 hover:bg-muted/10 transition-colors text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenEntry(entry)}
                      disabled={entry.isDirectory}
                      className={cn(
                        "col-span-6 md:col-span-7 flex items-center gap-2 truncate pr-2 text-left",
                        !entry.isDirectory && "cursor-pointer hover:underline underline-offset-2 disabled:no-underline"
                      )}
                      title={entry.isDirectory ? entry.path : `Open ${entry.path}`}
                    >
                      {entry.isDirectory ? (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-blue-500 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "truncate font-medium",
                          entry.isDirectory ? "text-foreground" : "text-foreground/90 font-normal"
                        )}
                      >
                        {entry.path}
                      </span>
                    </button>

                    <div className="col-span-3 md:col-span-2 text-right font-mono text-xs text-muted-foreground">
                      {entry.isDirectory ? "—" : formatBytes(entry.size)}
                    </div>

                    <div className="col-span-3 text-right text-xs text-muted-foreground hidden md:inline">
                      {entry.date ? entry.date.toLocaleDateString() : "—"}
                    </div>

                    <div className="col-span-3 md:col-span-2 flex justify-end gap-0.5">
                      {!entry.isDirectory && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEntry(entry)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
                            title="Open preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadEntry(entry)}
                            disabled={downloadingEntry === entry.path}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
                            title="Extract and download file"
                          >
                            <Download className={cn("h-3.5 w-3.5", downloadingEntry === entry.path && "animate-bounce")} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
                <FileCode className="h-8 w-8 text-muted-foreground/40" />
                <div>
                  <p className="font-semibold text-sm">No files matched your search</p>
                  <p className="text-xs text-muted-foreground/80">Try adjusting your filter or query</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
