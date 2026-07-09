"use client"

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SEARCH_GROUPS, fetchGlobalSearch, type SearchResult, type SearchResponse } from "@/lib/search-api"
import { useNavigate } from "@tanstack/react-router"
import { LoaderIcon, SearchIcon } from "lucide-react"

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLFormElement | null>(null)

  const groupedResults = useMemo(
    () =>
      SEARCH_GROUPS.map((group) => ({
        ...group,
        items: results?.results[group.key] ?? [],
      })),
    [results]
  )
  const flatResults = groupedResults.flatMap((group) => group.items)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (trimmedQuery.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsLoading(true)
      setError(null)
      fetchGlobalSearch(trimmedQuery, 5, controller.signal)
        .then((data) => {
          setResults(data)
          setIsOpen(true)
          setActiveIndex(-1)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setError("Search is unavailable")
          setResults(null)
        })
        .finally(() => setIsLoading(false))
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [trimmedQuery])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function goToSearchPage() {
    if (!trimmedQuery) return
    setIsOpen(false)
    navigate({ to: "/search" as never, search: { q: trimmedQuery } as never })
  }

  function openResult(result: SearchResult) {
    setIsOpen(false)
    void navigate({ to: result.url })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, -1))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const activeResult = flatResults[activeIndex]
      if (activeResult) openResult(activeResult)
      else goToSearchPage()
    }
  }

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const isMac = useMemo(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent),
    []
  )

  const handleGlobalShortcut = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalShortcut)
    return () => document.removeEventListener("keydown", handleGlobalShortcut)
  }, [handleGlobalShortcut])

  return (
    <form
      {...props}
      ref={containerRef}
      onSubmit={(event) => {
        event.preventDefault()
        goToSearchPage()
      }}
      className={cn("relative", props.className)}
    >
      <div
        className={cn(
          "group relative flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 transition-all duration-200",
          "sm:min-w-[280px]",
          isFocused
            ? "border-ring bg-background ring-2 ring-ring/20"
            : "border-transparent hover:bg-muted/70"
        )}
      >
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        {isLoading ? (
          <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground/70" />
        ) : (
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
        <input
          ref={inputRef}
          id="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            setIsFocused(true)
            setIsOpen(true)
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search..."
          autoComplete="off"
          className="h-8 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        {!isFocused && !query && (
          <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded-[5px] border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/70 sm:inline-flex">
            {isMac ? "⌘" : "Ctrl"}
            <span className="text-[9px]">K</span>
          </kbd>
        )}
      </div>
      {isOpen && trimmedQuery.length >= 2 ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {error ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{error}</div>
          ) : results && results.total === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
              <SearchIcon className="size-5 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No results for "{trimmedQuery}"</p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto py-1.5">
              {groupedResults.map((group) =>
                group.items.length ? (
                  <div key={group.key} className="py-1">
                    <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const itemIndex = flatResults.findIndex(
                        (result) => result.type === item.type && result.id === item.id
                      )
                      const Icon = group.icon
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg mx-1.5 px-2 py-2 text-left text-sm transition-colors",
                            activeIndex === itemIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                          style={{ width: "calc(100% - 12px)" }}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => openResult(item)}
                        >
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null
              )}
              <div className="mx-1.5 mt-1">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <SearchIcon className="size-3.5" />
                  View all results for "{trimmedQuery}"
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </form>
  )
}
