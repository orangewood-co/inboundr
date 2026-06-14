import { useEffect, useMemo, useState } from "react"
import { FileTextIcon, LoaderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { API_ORIGIN } from "@/lib/env"
import { resolveTemplate } from "./support-utils"
import type { SupportTemplate, Ticket } from "./types"

export function TemplatePicker({
  ticket,
  onInsert,
  disabled,
}: {
  ticket: Ticket | null
  onInsert: (text: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<SupportTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    setLoading(true)
    fetch(`${API_ORIGIN}/api/v1/support/templates`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setTemplates(data?.templates ?? [])
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, loaded])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return templates
    return templates.filter((template) =>
      [template.title, template.body, template.shortcut].join(" ").toLowerCase().includes(query)
    )
  }, [search, templates])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} className="gap-1.5">
              <FileTextIcon />
              Template
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Insert a saved reply</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" side="top" className="w-80 p-0">
        <div className="border-b p-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates..."
            className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" /> Loading templates...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">{search ? "No matches" : "No templates yet"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create reply templates in{" "}
                <a href="/settings?tab=support" className="text-primary hover:underline">
                  Settings
                </a>
                .
              </p>
            </div>
          ) : (
            filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  onInsert(resolveTemplate(template.body, ticket))
                  setOpen(false)
                  setSearch("")
                }}
                className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{template.title}</span>
                  {template.shortcut && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      /{template.shortcut}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{template.body}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
