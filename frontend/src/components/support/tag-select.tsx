import { useMemo, useState, type ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { TAG_DOT_STYLES } from "./tag-chip"
import type { SupportTicketTag, SupportTicketTagColor } from "./types"

export function TagMultiSelect({
  trigger,
  tags,
  selectedIds,
  onToggle,
  align = "start",
  emptyLabel = "No tags yet.",
}: {
  trigger: ReactNode
  tags: SupportTicketTag[]
  selectedIds: string[]
  onToggle: (tagId: string, selected: boolean) => void
  align?: "start" | "center" | "end"
  emptyLabel?: string
}) {
  const [search, setSearch] = useState("")
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tags
    return tags.filter((tag) => tag.name.toLowerCase().includes(term))
  }, [search, tags])

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <div className="border-b p-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags..."
            className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {tags.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">{emptyLabel}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No matching tags.</p>
          ) : (
            filtered.map((tag) => {
              const isSelected = selected.has(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggle(tag.id, !isSelected)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" tabIndex={-1} />
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      TAG_DOT_STYLES[tag.color as SupportTicketTagColor] ?? TAG_DOT_STYLES.slate
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
