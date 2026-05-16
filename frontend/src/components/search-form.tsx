"use client"

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { SidebarInput } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { fetchGlobalSearch, type SearchResult, type SearchResponse } from "@/lib/search-api"
import { useNavigate } from "@tanstack/react-router"
import { Building2Icon, FileTextIcon, LoaderIcon, PackageIcon, SearchIcon } from "lucide-react"

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
    () => [
      { key: "customers", label: "Customers", icon: Building2Icon, items: results?.results.customers ?? [] },
      { key: "products", label: "Products", icon: PackageIcon, items: results?.results.products ?? [] },
      { key: "rfqs", label: "RFQs", icon: FileTextIcon, items: results?.results.rfqs ?? [] },
    ],
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
    window.location.href = result.url
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
      <div className="relative">
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <SidebarInput
          id="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search customers, products, RFQs..."
          className="h-8 pl-7"
          autoComplete="off"
        />
        {isLoading ? (
          <LoaderIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 animate-spin opacity-50 select-none" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
        )}
      </div>
      {isOpen && trimmedQuery.length >= 2 ? (
        <div className="absolute right-0 top-10 z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          {error ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{error}</div>
          ) : results && results.total === 0 && !isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results for "{trimmedQuery}"</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto py-2">
              {groupedResults.map((group) =>
                group.items.length ? (
                  <div key={group.key} className="py-1">
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                            "flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent",
                            activeIndex === itemIndex && "bg-accent"
                          )}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => openResult(item)}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
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
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-medium hover:bg-accent"
              >
                <SearchIcon className="size-4 text-muted-foreground" />
                View all results for "{trimmedQuery}"
              </button>
            </div>
          )}
        </div>
      ) : null}
    </form>
  )
}
