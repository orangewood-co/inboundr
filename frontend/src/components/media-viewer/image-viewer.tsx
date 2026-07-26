import * as React from "react"
import { useState } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Download, ExternalLink, AlertTriangle } from "lucide-react"
import { ToolbarButton, ToolbarDivider, ToolbarLink, ViewerSpinner, downloadFile } from "./viewer-toolbar"

interface ImageViewerProps {
  url: string
  name: string
}

export default function ImageViewer({ url, name }: ImageViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [rotation, setRotation] = useState(0)

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <TransformWrapper minScale={0.5} maxScale={8} centerOnInit doubleClick={{ mode: "toggle" }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="flex items-center justify-end gap-0.5 border-b bg-background px-2 py-1.5">
              <ToolbarButton onClick={() => zoomOut()} disabled={status !== "ready"} label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton onClick={() => zoomIn()} disabled={status !== "ready"} label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton onClick={() => setRotation((r) => (r + 90) % 360)} disabled={status !== "ready"} label="Rotate">
                <RotateCw className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  resetTransform()
                  setRotation(0)
                }}
                disabled={status !== "ready"}
                label="Reset view"
              >
                <Maximize2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarDivider />
              <ToolbarButton onClick={() => downloadFile(url, name)} label="Download">
                <Download className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarLink href={url} label="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </ToolbarLink>
            </div>

            <div
              className="relative flex-1 overflow-hidden bg-muted/40"
              style={{
                backgroundImage:
                  "conic-gradient(rgba(0,0,0,0.04) 25%, transparent 0 50%, rgba(0,0,0,0.04) 0 75%, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            >
              {status === "loading" && <ViewerSpinner />}
              {status === "error" ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <p className="text-sm font-medium text-foreground">Couldn&apos;t load this image</p>
                </div>
              ) : (
                <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full !flex !items-center !justify-center">
                  <img
                    src={url}
                    alt={name}
                    draggable={false}
                    onLoad={() => setStatus("ready")}
                    onError={() => setStatus("error")}
                    style={{ transform: `rotate(${rotation}deg)`, transition: "transform 150ms ease" }}
                    className="max-h-[68svh] max-w-full select-none object-contain"
                  />
                </TransformComponent>
              )}
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
