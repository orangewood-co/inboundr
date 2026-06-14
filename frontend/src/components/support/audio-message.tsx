import { MicIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fileSize } from "./support-utils"
import type { TicketAttachment } from "./types"

export function AudioMessage({
  attachment,
  tone = "neutral",
}: {
  attachment: TicketAttachment
  tone?: "neutral" | "agent"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2",
        tone === "agent" ? "border-primary/20 bg-background/40" : "border-border bg-background/60"
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <MicIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-foreground/80">Voice message</p>
        {attachment.url ? (
          <audio controls preload="metadata" src={attachment.url} className="h-8 w-full max-w-[16rem]" />
        ) : (
          <p className="text-xs text-muted-foreground">Audio unavailable</p>
        )}
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {fileSize(attachment.size)}
      </span>
    </div>
  )
}
