import { useEffect } from "react"
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router"

const APP_TITLE = "Inboundr"

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/emails": "Emails",
  "/forgot-password": "Forgot Password",
  "/forms": "Forms",
  "/login": "Login",
  "/products": "Products",
  "/register": "Register",
  "/reset-password": "Reset Password",
  "/settings": "Settings",
}

export const Route = createRootRoute({
  component: RootRouteComponent,
})

function RootRouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    const exactTitle = PAGE_TITLES[pathname]
    if (exactTitle) {
      document.title = `${exactTitle} | ${APP_TITLE}`
      return
    }

    if (pathname.startsWith("/forms/")) {
      document.title = `Form Editor | ${APP_TITLE}`
      return
    }

    document.title = APP_TITLE
  }, [pathname])

  return <Outlet />
}
