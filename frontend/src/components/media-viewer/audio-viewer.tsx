import { useState } from "react"
import { Music, Download, ExternalLink, AlertTriangle } from "lucide-react"
import { ToolbarButton, ToolbarLink } from "./viewer-toolbar"
import { downloadFile } from "./viewer-utils"

interface AudioViewerProps {
  url: string
  name: string
}

export default function AudioViewer({ url, name }: AudioViewerProps) {
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

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        {status === "error" ? (
          <>
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Couldn&apos;t play this audio file</p>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="max-w-xs truncate text-center text-sm font-medium text-foreground">{name}</p>
            <audio
              src={url}
              controls
              className="w-full max-w-sm"
              onCanPlay={() => setStatus("ready")}
              onError={() => setStatus("error")}
            />
          </>
        )}
      </div>
    </div>
  )
}
