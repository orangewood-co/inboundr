import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { SearchIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface RenderedItem {
  title: string
  subtitle?: string
}

interface SearchablePickerDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  placeholder?: string
  fetchItems: (query: string, signal: AbortSignal) => Promise<T[]>
  getKey: (item: T) => string
  renderItem: (item: T) => RenderedItem
  onSelect: (item: T) => void
  manualEntryLabel?: string
  onManualEntry?: () => void
}

export function SearchablePickerDialog<T>({
  open,
  onOpenChange,
  title,
  placeholder = "Search…",
  fetchItems,
  getKey,
  renderItem,
  onSelect,
  manualEntryLabel,
  onManualEntry,
}: SearchablePickerDialogProps<T>) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Reset transient state whenever the dialog is closed.
  useEffect(() => {
    if (!open) {
      setQuery("")
      setItems([])
      setError(null)
      setActiveIndex(-1)
      setIsLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsLoading(true)
      setError(null)
      fetchItems(trimmed, controller.signal)
        .then((results) => {
          setItems(results)
          setActiveIndex(-1)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setError("Unable to load results")
          setItems([])
        })
        .finally(() => setIsLoading(false))
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, query, fetchItems])

  function choose(item: T) {
    onSelect(item)
    onOpenChange(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, items.length - 1))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, -1))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const activeItem = items[activeIndex]
      if (activeItem) choose(activeItem)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          {isLoading ? (
            <Spinner className="size-4 shrink-0 text-muted-foreground/70" />
          ) : (
            <SearchIcon className="size-4 shrink-0 text-muted-foreground/70" />
          )}
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            className="h-12 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-1.5">
          {error ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">{error}</div>
          ) : items.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
              <SearchIcon className="size-5 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {query.trim() ? `No results for "${query.trim()}"` : "No results"}
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const rendered = renderItem(item)
              return (
                <button
                  key={getKey(item)}
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                >
                  <span className="block w-full truncate font-medium">{rendered.title}</span>
                  {rendered.subtitle ? (
                    <span className="block w-full truncate text-xs text-muted-foreground">
                      {rendered.subtitle}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
        {manualEntryLabel && onManualEntry ? (
          <div className="border-t p-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onManualEntry()
                onOpenChange(false)
              }}
            >
              {manualEntryLabel}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
