import { useState } from "react"
import { Download, ExternalLink, AlertTriangle } from "lucide-react"
import { ToolbarButton, ToolbarLink } from "./viewer-toolbar"
import { downloadFile } from "./viewer-utils"

interface VideoViewerProps {
  url: string
  name: string
}

export default function VideoViewer({ url, name }: VideoViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-end gap-0.5 border-b bg-background px-2 py-1.5">
        <ToolbarButton onClick={() => downloadFile(url, name)} label="Download">
          <Download className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarLink href={url} label="Open in new tab">
          <ExternalLink className="h-4 w-4" />
        </ToolbarLink>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-black">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-white">Couldn&apos;t play this video</p>
          </div>
        )}
        <video
          src={url}
          controls
          className="max-h-full max-w-full"
          style={status === "error" ? { display: "none" } : undefined}
          onCanPlay={() => setStatus("ready")}
          onError={() => setStatus("error")}
        >
          <track kind="captions" />
        </video>
      </div>
    </div>
  )
}
