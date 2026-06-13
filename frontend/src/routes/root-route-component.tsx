import { useEffect } from "react"
import { Outlet, useRouterState } from "@tanstack/react-router"

import { PostHogAnalytics } from "@/lib/posthog"

const APP_TITLE = "Inboundr"

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/admin": "Super Admin",
  "/admin/organizations/$id": "Organization Admin",
  "/chat": "AI Chat",
  "/rfq": "RFQ",
  "/customers": "Customers",
  "/customers/import": "Import Customers",
  "/customers/$id": "Customer Details",
  "/drive": "Drive",
  "/emails": "Emails",
  "/employees": "Employees",
  "/employees/new": "New Employee",
  "/forgot-password": "Forgot Password",
  "/forms": "Forms",
  "/invoices": "Invoices",
  "/invoices/new": "New Invoice",
  "/links": "Links",
  "/links/create": "Create Link",
  "/links/$id": "Link Details",
  "/login": "Login",
  "/products": "Products",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/register": "Register",
  "/reset-password": "Reset Password",
  "/settings": "Settings",
  "/stats": "Stats",
  "/support": "Support",
}
import { documentTitleForPath } from "@/lib/route-meta"

export function RootRouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    document.title = documentTitleForPath(pathname)
  }, [pathname])

  return (
    <>
      <PostHogAnalytics />
      <Outlet />
    </>
  )
}
