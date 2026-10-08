import { useState } from "react"
import { ChevronDownIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getEmbedOrigin } from "@/lib/env"
import { useOrganizationMe } from "@/lib/queries"
import { copyToClipboard } from "@/lib/utils"

type LauncherPosition = "right" | "left"

const API_EXAMPLE = `// Open, close, or toggle the chat from your own buttons
InboundrChat("open")

// Prefill the pre-chat form for signed-in users
InboundrChat("identify", { name: "Jane Doe", email: "jane@example.com", phone: "+919876543210" })

// Forget this visitor's conversation, e.g. on logout
InboundrChat("shutdown")

// React to new replies while the chat is closed
window.addEventListener("inboundr:chat:unread", (event) => console.log(event.detail.count))`

export function ChatWidgetInstall() {
  const { data } = useOrganizationMe()
  const [position, setPosition] = useState<LauncherPosition>("right")
  const organizationId = data?.organization?._id ? String(data.organization._id) : ""

  if (!organizationId) return null

  const snippet = `<script async src="${getEmbedOrigin()}/support-widget.js" data-organization="${organizationId}"${
    position === "left" ? ' data-position="left"' : ""
  }></script>`

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install on Your Website</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste this snippet just before the closing &lt;/body&gt; tag on every page where the chat
            bubble should appear.
          </p>
        </div>
        <Select value={position} onValueChange={(value) => setPosition(value as LauncherPosition)}>
          <SelectTrigger size="sm" aria-label="Launcher position" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Bottom Right</SelectItem>
            <SelectItem value="left">Bottom Left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-foreground p-3 text-[11px] leading-5 text-background">
        {snippet}
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => copyToClipboard(snippet, "Chat widget snippet copied")}
      >
        <CopyIcon />
        Copy Snippet
      </Button>
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground">
          <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          JavaScript API
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. Add <code>data-hide-launcher</code> to the script tag to use your own button instead
            of the bubble.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground p-3 text-[11px] leading-5 text-background">
            {API_EXAMPLE}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
