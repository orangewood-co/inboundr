import { Link, useLocation } from "@tanstack/react-router"
import { BriefcaseBusinessIcon, LayoutDashboardIcon, Settings2Icon, UsersRoundIcon } from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader, type BreadcrumbSegment } from "@/components/site-header"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/recruitment", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/recruitment/jobs", label: "Jobs", icon: BriefcaseBusinessIcon },
  { href: "/recruitment/applicants", label: "Applicants", icon: UsersRoundIcon },
  { href: "/recruitment/settings", label: "Careers site", icon: Settings2Icon },
]

export function RecruitmentShell({
  children,
  breadcrumbs = [{ label: "Recruitment" }],
  actions,
}: {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbSegment[]
  actions?: React.ReactNode
}) {
  const { pathname } = useLocation()
  return (
    <AppLayout>
      <SiteHeader breadcrumbs={breadcrumbs} actions={actions} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/20">
        <div className="border-b bg-background px-5">
          <nav className="mx-auto flex max-w-[1600px] gap-1" aria-label="Recruitment sections">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/recruitment" ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-5 md:p-8">{children}</main>
      </div>
    </AppLayout>
  )
}

export function RecruitmentPageTitle({
  eyebrow = "Recruitment workspace",
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
