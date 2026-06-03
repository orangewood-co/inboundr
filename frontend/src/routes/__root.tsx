import { useEffect } from "react"
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router"

import { ErrorPage, NotFoundPage } from "@/components/error-boundary"

const APP_TITLE = "Inboundr"

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/admin": "Super Admin",
  "/admin/organizations/$id": "Organization Admin",
  "/rfq": "RFQ",
  "/customers": "Customers",
  "/customers/import": "Import Customers",
  "/customers/$id": "Customer Details",
  "/drive": "Drive",
  "/drive/share/$token": "Shared Drive Item",
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
}

export const Route = createRootRoute({
  component: RootRouteComponent,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
})

function RootRouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    const exactTitle = PAGE_TITLES[pathname]
    if (exactTitle) {
      document.title = `${exactTitle} - ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/forms/")) {
      document.title = `Form Editor - ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/invoices/") && pathname !== "/invoices/new") {
      document.title = `Invoice Details - ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/customers/") && pathname !== "/customers/import") {
      document.title = `Customer Details - ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/employees/") && pathname !== "/employees/new") {
      document.title = `Employee Details - ${APP_TITLE}`
      return
    }

    if (pathname.includes("/tasks/")) {
      document.title = `Task Details - ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/projects/") && pathname !== "/projects/new") {
      document.title = `Project Details - ${APP_TITLE}`
      return
    }

    document.title = APP_TITLE
  }, [pathname])

  return <Outlet />
}
