import { Outlet, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: RootRouteComponent,
})

function RootRouteComponent() {
  return <Outlet />
}
