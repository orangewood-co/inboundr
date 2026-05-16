import { useEffect, useMemo, useState } from "react"
import { useSearch } from "@tanstack/react-router"
import { AlertCircleIcon, Building2Icon, FileTextIcon, LoaderIcon, PackageIcon, SearchIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { fetchGlobalSearch, type SearchResult, type SearchResponse } from "@/lib/search-api"
import { cn } from "@/lib/utils"

type SearchParams = {
  q?: string
}

const groups = [
  { key: "customers", label: "Customers", icon: Building2Icon },
  { key: "products", label: "Products", icon: PackageIcon },
  { key: "rfqs", label: "RFQs", icon: FileTextIcon },
] as const

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = result.url
      }}
      className="group flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
    >
      <div className="mt-0.5 rounded-lg bg-muted p-2">
        {result.type === "customer" ? (
          <Building2Icon className="size-4 text-muted-foreground" />
        ) : result.type === "product" ? (
          <PackageIcon className="size-4 text-muted-foreground" />
        ) : (
          <FileTextIcon className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold group-hover:text-foreground">{result.title}</div>
        <div className="mt-1 truncate text-sm text-muted-foreground">{result.subtitle || "No additional details"}</div>
      </div>
    </button>
  )
}

function SearchPageContent() {
  const search = useSearch({ strict: false }) as SearchParams
  const initialQuery = search.q ?? ""
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = initialQuery.trim()
    if (trimmed.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsLoading(true)
      setError(null)
      fetchGlobalSearch(trimmed, 20, controller.signal)
        .then(setResults)
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setError("Search is unavailable right now.")
          setResults(null)
        })
        .finally(() => setIsLoading(false))
    }, 0)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [initialQuery])

  const total = results?.total ?? 0
  const groupedResults = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        items: results?.results[group.key] ?? [],
      })),
    [results]
  )

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="max-w-3xl space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
              <p className="text-sm text-muted-foreground">
                Find customers, catalog products, and RFQs across the active organization.
              </p>
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = query.trim()
                window.location.href = `/search?q=${encodeURIComponent(trimmed)}`
              }}
            >
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by company, product code, RFQ subject..."
                  className="pl-9"
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" />
            Searching organization data...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            <AlertCircleIcon className="size-4" />
            {error}
          </div>
        ) : initialQuery.trim().length < 2 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Enter at least 2 characters to search.
          </div>
        ) : total === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No results for "{initialQuery}".
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="text-sm text-muted-foreground">
              Showing {total} result{total === 1 ? "" : "s"} for "{initialQuery}".
            </div>
            {groupedResults.map((group) => {
              const Icon = group.icon
              return (
                <section key={group.key} className={cn("space-y-3", group.items.length === 0 && "hidden")}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">{group.label}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {group.items.map((result) => (
                      <ResultCard key={`${result.type}-${result.id}`} result={result} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <SearchPageContent />
      </SidebarInset>
    </SidebarProvider>
  )
}
