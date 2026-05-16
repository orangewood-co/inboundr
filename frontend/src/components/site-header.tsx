import { SearchForm } from "@/components/search-form"
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
import { Link, useLocation } from "@tanstack/react-router"
import { PanelLeftIcon } from "lucide-react"
import { Fragment } from "react"

export type BreadcrumbSegment = {
  label: string
  href?: string
}

const pageTitles: Record<string, string> = {
  "/": "RFQ",
  "/emails": "Inbox",
  "/products": "Products",
  "/search": "Search",
  "/settings": "Settings",
  "/forms": "Forms",
  "/customers": "Customers",
  "/stats": "Stats",
}

export function SiteHeader({
  breadcrumbs,
  actions,
}: {
  breadcrumbs?: BreadcrumbSegment[]
  actions?: React.ReactNode
} = {}) {
  const { toggleSidebar } = useSidebar()
  const { pathname } = useLocation()

  const segments: BreadcrumbSegment[] = breadcrumbs ?? [
    { label: pageTitles[pathname] ?? "Dashboard" },
  ]

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
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : (
          <SearchForm className="w-full sm:ml-auto sm:w-auto" />
        )}
      </div>
    </header>
  )
}
