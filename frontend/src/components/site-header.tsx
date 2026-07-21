import { SearchForm } from "@/components/search-form"
import { NotificationBell } from "@/components/notification-bell"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Link, useLocation } from "@tanstack/react-router"
import { MoonIcon, PanelLeftIcon } from "lucide-react"
import { Fragment, useEffect, useState } from "react"

import { ROUTE_LABELS } from "@/lib/route-meta"

export type BreadcrumbSegment = {
  label: string
  href?: string
}

function breadcrumbsForPath(pathname: string): BreadcrumbSegment[] {
  if (pathname.startsWith("/admin/organizations/")) {
    return [
      { label: "Super Admin", href: "/admin" },
      { label: "Organization" },
    ]
  }

  const label = ROUTE_LABELS[pathname]
  if (label) return [{ label }]

  // Unknown (usually dynamic) path: anchor the crumb to the nearest known ancestor.
  const segments = pathname.split("/").filter(Boolean)
  while (segments.length > 1) {
    segments.pop()
    const parentPath = `/${segments.join("/")}`
    const parentLabel = ROUTE_LABELS[parentPath]
    if (parentLabel) {
      return [{ label: parentLabel, href: parentPath }, { label: "Details" }]
    }
  }

  return [{ label: "Home" }]
}

// Easter egg: a quiet moon for anyone working between 1 and 5 AM.
function useIsLateNight() {
  const [hour, setHour] = useState(() => new Date().getHours())

  useEffect(() => {
    const interval = window.setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return hour >= 1 && hour < 5
}

export function SiteHeader({
  breadcrumbs,
  actions,
  leadingActions,
}: {
  breadcrumbs?: BreadcrumbSegment[]
  actions?: React.ReactNode
  leadingActions?: React.ReactNode
} = {}) {
  const { toggleSidebar } = useSidebar()
  const { pathname } = useLocation()
  const isLateNight = useIsLateNight()

  const segments: BreadcrumbSegment[] = breadcrumbs ?? breadcrumbsForPath(pathname)

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <PanelLeftIcon />
        </Button>
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">inboundr.</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((segment, i) => (
              <Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {segment.href ? (
                    <BreadcrumbLink asChild>
                      <Link to={segment.href}>{segment.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {isLateNight && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 hidden text-muted-foreground/70 sm:inline-flex">
                  <MoonIcon className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>It's late — go to sleep</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {actions ? (
          <div className="ml-auto flex items-center gap-2">
            {leadingActions}
            {actions}
            <Separator
              orientation="vertical"
              className="mx-1 data-vertical:h-4 data-vertical:self-auto"
            />
            <NotificationBell />
          </div>
        ) : (
          <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
            {leadingActions}
            <NotificationBell />
            <SearchForm className="w-full sm:w-auto" />
          </div>
        )}
      </div>
    </header>
  )
}
