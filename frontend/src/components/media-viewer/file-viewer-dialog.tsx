import * as React from "react"
import { DRIVE_MIME_TYPE_LABELS, type DriveNode } from "@/lib/drive"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, ExternalLink, FileQuestion } from "lucide-react"
import { downloadFile } from "./viewer-toolbar"
import ZipViewer from "./zip-viewer"
import PdfViewer from "./pdf-viewer"
import DocxViewer from "./docx-viewer"
import XlsxViewer from "./xlsx-viewer"
import ImageViewer from "./image-viewer"
import VideoViewer from "./video-viewer"
import AudioViewer from "./audio-viewer"
import HtmlViewer from "./html-viewer"
import { EXTENSION_TO_MIME } from "@/lib/drive"

export type ViewerComponentProps = { url: string; name: string }
export type ViewerComponent = React.ComponentType<ViewerComponentProps>

export const MIME_MAP: Record<string, ViewerComponent> = {
  "audio/*": AudioViewer,
  "video/*": VideoViewer,
  "image/*": ImageViewer,
  "text/*": HtmlViewer,

  "application/pdf": PdfViewer,

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    DocxViewer,
  "application/msword": DocxViewer,

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    XlsxViewer,
  "application/vnd.ms-excel": XlsxViewer,
  "application/vnd.oasis.opendocument.spreadsheet": XlsxViewer,
  "text/csv": XlsxViewer,
  "text/tab-separated-values": XlsxViewer,

  "application/json": HtmlViewer,
  "application/xml": HtmlViewer,
  "application/x-yaml": HtmlViewer,
  "application/javascript": HtmlViewer,
  "application/typescript": HtmlViewer,

  "image/svg+xml": ImageViewer,
}

function normalizeMime(raw: string): string {
  return raw.split(";")[0].trim().toLowerCase()
}

const ZIP_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
])

export function isZipMimeType(contentType: string): boolean {
  return ZIP_MIME_TYPES.has(normalizeMime(contentType || ""))
}

export function isZipFileName(fileName: string): boolean {
  return (fileName.split(".").pop()?.toLowerCase() ?? "") === "zip"
}

export function isZipFile(contentType: string, fileName: string): boolean {
  return isZipMimeType(contentType) || isZipFileName(fileName)
}

function lookupWildcard(mimeType: string): ViewerComponent | null {
  for (const [key, component] of Object.entries(MIME_MAP)) {
    if (key.endsWith("/*")) {
      const prefix = key.slice(0, -2)
      if (mimeType.startsWith(prefix + "/")) {
        return component
      }
    }
  }
  return null
}

export function getComponentForMimeType(
  contentType: string,
  fileName: string
): ViewerComponent | null {
  const mimeType = normalizeMime(contentType || "")

  if (mimeType && MIME_MAP[mimeType]) {
    return MIME_MAP[mimeType]
  }

  if (mimeType) {
    const wildcardMatch = lookupWildcard(mimeType)
    if (wildcardMatch) return wildcardMatch
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  const fallbackMime = EXTENSION_TO_MIME[ext as keyof typeof EXTENSION_TO_MIME]
  if (fallbackMime) {
    if (MIME_MAP[fallbackMime]) {
      return MIME_MAP[fallbackMime]
    }
    const wildcardMatch = lookupWildcard(fallbackMime)
    if (wildcardMatch) return wildcardMatch
  }

  return null
}


export default function FileViewerDialog({
  viewer,
  onOpenChange,
}: {
  viewer: { node: DriveNode; url: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const type = DRIVE_MIME_TYPE_LABELS[viewer?.node.contentType as keyof typeof DRIVE_MIME_TYPE_LABELS || "application/octet-stream"]
  const name = viewer?.node.name ?? ""
  console.log(type,name)
  const ViewerComponent = viewer ? (isZipFile(type, name) ? ZipViewer : getComponentForMimeType(type,name)) : null

  return (
    <Dialog open={Boolean(viewer)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-6xl min-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{type || "File preview"}</DialogDescription>
        </DialogHeader>

        {viewer && (
          <>
            {ViewerComponent ? (
              React.createElement(ViewerComponent, { url: viewer.url, name: name })
            ) : (
              <div className="flex h-[50svh] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/40 text-center">
                <FileQuestion className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-foreground">No preview available for this file type</p>
                  {type && <p className="mt-1 text-xs text-muted-foreground">{type}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadFile(viewer.url, name)}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Download className="h-4 w-4" />
                    Download {name}
                  </button>
                  <a
                    href={viewer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
