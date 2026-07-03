import { useEffect, useRef, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  FIELD_TYPE_META,
  FIELD_TYPE_ORDER,
  type FieldType,
} from "@/components/forms/types"

export function BlockInsertMenu({
  children,
  onInsert,
  open,
  onOpenChange,
  align = "start",
  side = "bottom",
}: {
  children: React.ReactNode
  onInsert: (type: FieldType) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
}) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const matches = FIELD_TYPE_ORDER.filter((type) => {
    if (!query.trim()) return true
    const meta = FIELD_TYPE_META[type]
    const haystack = `${meta.label} ${meta.description}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[data-active='true']")
    active?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function reset() {
    setQuery("")
    setActiveIndex(0)
  }

  function select(type: FieldType) {
    onInsert(type)
    onOpenChange?.(false)
    reset()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const type = matches[activeIndex]
      if (type) select(type)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next)
        if (!next) reset()
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-72 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search question types..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matching question types
            </p>
          ) : (
            matches.map((type, index) => {
              const meta = FIELD_TYPE_META[type]
              const Icon = meta.icon
              return (
                <button
                  key={type}
                  type="button"
                  data-active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(type)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                    index === activeIndex ? "bg-muted" : "bg-transparent",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{meta.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{meta.description}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
