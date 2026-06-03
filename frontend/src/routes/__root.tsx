import { createRootRoute } from "@tanstack/react-router"

import { ErrorPage, NotFoundPage } from "@/components/error-boundary"
import { RootRouteComponent } from "@/routes/root-route-component"

export const Route = createRootRoute({
  component: RootRouteComponent,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
})
