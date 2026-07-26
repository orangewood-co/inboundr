import type * as React from "react"
import { EXTENSION_TO_MIME } from "@/lib/drive"
import PdfViewer from "./pdf-viewer"
import DocxViewer from "./docx-viewer"
import XlsxViewer from "./xlsx-viewer"
import ImageViewer from "./image-viewer"
import VideoViewer from "./video-viewer"
import AudioViewer from "./audio-viewer"
import HtmlViewer from "./html-viewer"

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

export function normalizeMime(raw: string): string {
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

export function downloadFile(url: string, name: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
