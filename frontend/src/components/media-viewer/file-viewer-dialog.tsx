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
import ZipViewer from "./zip-viewer"
import {
  downloadFile,
  getComponentForMimeType,
  isZipFile,
  normalizeMime,
} from "./viewer-utils"

export default function FileViewerDialog({
  viewer,
  onOpenChange,
}: {
  viewer: { node: DriveNode; url: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const contentType = viewer?.node.contentType ?? ""
  const name = viewer?.node.name ?? ""
  const type =
    DRIVE_MIME_TYPE_LABELS[
      normalizeMime(contentType) as keyof typeof DRIVE_MIME_TYPE_LABELS
    ] ?? normalizeMime(contentType)
  const ViewerComponent = viewer
    ? isZipFile(contentType, name)
      ? ZipViewer
      : getComponentForMimeType(contentType, name)
    : null

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
