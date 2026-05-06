import { createFileRoute } from "@tanstack/react-router"

import { redirectIfAuthenticated } from "@/lib/auth-guards"
import { LoginPage } from "@/pages/login-page"

export const Route = createFileRoute("/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})
