import { createFileRoute } from "@tanstack/react-router"

import { redirectIfAuthenticated } from "@/lib/auth-guards"
import { RegisterPage } from "@/pages/register-page"

export const Route = createFileRoute("/register")({
  beforeLoad: redirectIfAuthenticated,
  component: RegisterPage,
})
