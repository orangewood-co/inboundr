import { useEffect } from "react"
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router"

const APP_TITLE = "Inboundr"

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/emails": "Emails",
  "/forgot-password": "Forgot Password",
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
    const pageTitle = PAGE_TITLES[pathname]

    document.title = pageTitle ? `${pageTitle} | ${APP_TITLE}` : APP_TITLE
  }, [pathname])

  return <Outlet />
}
