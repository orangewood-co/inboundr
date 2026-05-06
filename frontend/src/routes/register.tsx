import { createFileRoute } from "@tanstack/react-router"

import { RegisterPage } from "@/pages/register-page"

export const Route = createFileRoute("/register")({
  component: RegisterPage,
})
