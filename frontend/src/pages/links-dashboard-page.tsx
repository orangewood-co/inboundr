import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BarChart3Icon,
  CalendarIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FilterIcon,
  LayoutGridIcon,
  LayoutListIcon,
  LinkIcon,
  ListIcon,
  LoaderIcon,
  LockIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/links`

type ShortLink = {
  _id: string
  code: string
  destinationUrl: string
  title: string | null
  status: "active" | "disabled" | "archived"
  trackingMode: "standard" | "precise_location"
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  hasPassword: boolean
  updatedAt: string
  createdAt?: string
}

function shortUrl(code: string) {
  return `${API_ORIGIN}/l/${code}`
}

function isExpired(link: ShortLink) {
  return Boolean(link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())
}

function isMaxed(link: ShortLink) {
  return typeof link.maxViews === "number" && link.viewCount >= link.maxViews
}

function availabilityLabel(link: ShortLink) {
  if (link.status !== "active") return link.status
  if (isExpired(link)) return "expired"
  if (isMaxed(link)) return "maxed"
  return "active"
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

function faviconUrl(destinationUrl: string) {
  const domain = extractDomain(destinationUrl)
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : ""
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type StatusFilter = "active" | "all"

export default function LinksDashboardPage() {
  const navigate = useNavigate()
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch links")
      const data = (await response.json()) as { links: ShortLink[] }
      setLinks(data.links)
    } catch {
      toast.error("Failed to load links")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLinks()
  }, [fetchLinks])

  const filtered = useMemo(() => {
    let result = links

    if (statusFilter === "active") {
      result = result.filter((l) => availabilityLabel(l) === "active")
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          (l.title ?? "").toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q) ||
          l.destinationUrl.toLowerCase().includes(q),
      )
    }

    return result
  }, [links, search, statusFilter])

  async function archiveLink(link: ShortLink) {
    await fetch(`${API_BASE}/${link._id}`, { method: "DELETE", credentials: "include" })
    toast.success("Link archived")
    void fetchLinks()
  }

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(shortUrl(code))
    toast.success("Short link copied")
  }

  return (
    <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Links" }]} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            {/* Page title + Create button */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">Links</h1>
              <Button asChild>
                <Link to="/links/create">
                  <PlusIcon className="size-4" />
                  Create link
                </Link>
              </Button>
            </div>

            {/* Toolbar */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search links"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 pl-9"
                />
              </div>
              <Button variant="outline" size="sm" disabled>
                <CalendarIcon className="size-4" />
                Filter by created date
              </Button>
              <Button variant="outline" size="sm" disabled>
                <FilterIcon className="size-4" />
                Add filters
              </Button>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {filtered.length} link{filtered.length !== 1 ? "s" : ""}
                </span>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Show: Active</SelectItem>
                    <SelectItem value="all">Show: All</SelectItem>
                  </SelectContent>
                </Select>
                <Separator orientation="vertical" className="mx-1 h-5" />
                <div className="flex items-center rounded-md border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none">
                        <ListIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>List view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-x" disabled>
                        <LayoutListIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compact view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" disabled>
                        <LayoutGridIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Grid view</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Link list */}
            {loading ? (
              <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderIcon className="size-4 animate-spin" />
                Loading links...
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-12 rounded-2xl border border-dashed p-14 text-center">
                <LinkIcon className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-4 text-lg font-semibold">
                  {links.length === 0 ? "No links yet" : "No matching links"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {links.length === 0
                    ? "Create your first short link to start tracking engagement."
                    : "Try adjusting your search or filters."}
                </p>
                {links.length === 0 && (
                  <Button className="mt-5" asChild>
                    <Link to="/links/create">
                      <PlusIcon className="size-4" />
                      Create a link
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-5 divide-y rounded-xl border bg-card">
                {filtered.map((link) => (
                  <LinkRow
                    key={link._id}
                    link={link}
                    onCopy={() => void copyLink(link.code)}
                    onArchive={() => void archiveLink(link)}
                    onNavigate={() => void navigate({ to: "/links/$id", params: { id: link._id } })}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
    </AppLayout>
  )
}

function LinkRow({
  link,
  onCopy,
  onArchive,
  onNavigate,
}: {
  link: ShortLink
  onCopy: () => void
  onArchive: () => void
  onNavigate: () => void
}) {
  const status = availabilityLabel(link)
  const faded = status !== "active"
  const favicon = faviconUrl(link.destinationUrl)

  return (
    <div
      className={`flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-muted/40 ${faded ? "opacity-60" : ""}`}
      onClick={onNavigate}
    >
      {/* Favicon */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
        {favicon ? (
          <img
            src={favicon}
            alt=""
            className="size-5"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
              ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden")
            }}
          />
        ) : null}
        <LinkIcon className={`size-4 text-muted-foreground ${favicon ? "hidden" : ""}`} />
      </div>

      {/* Link info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">
            {link.title || `${extractDomain(link.destinationUrl)} – untitled`}
          </p>
          {link.hasPassword && (
            <Tooltip>
              <TooltipTrigger>
                <LockIcon className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Password protected</TooltipContent>
            </Tooltip>
          )}
          {link.trackingMode === "precise_location" && (
            <Tooltip>
              <TooltipTrigger>
                <MapPinIcon className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Precise location tracking</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onCopy() }}
            className="truncate text-sm font-medium text-primary hover:underline"
          >
            {shortUrl(link.code).replace(/^https?:\/\//, "")}
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={(e) => { e.stopPropagation(); onCopy() }} className="shrink-0 text-muted-foreground hover:text-foreground">
                <CopyIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy link</TooltipContent>
          </Tooltip>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLinkIcon className="size-3" />
          <span className="truncate">{link.destinationUrl}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BarChart3Icon className="size-3.5" />
          <span>{link.viewCount} engagement{link.viewCount !== 1 ? "s" : ""}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(link.updatedAt)}
        </p>
        {status !== "active" && (
          <Badge variant="secondary" className="mt-1 text-xs capitalize">
            {status}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
              <ShareIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNavigate}>
              <BarChart3Icon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Analytics</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onCopy}>
              <CopyIcon className="size-4" />
              <span>Copy short link</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(link.destinationUrl, "_blank")}
            >
              <ExternalLinkIcon className="size-4" />
              <span>Open destination</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="text-destructive">
              <Trash2Icon className="size-4" />
              <span>Archive</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
