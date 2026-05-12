import { createFileRoute } from "@tanstack/react-router"

import PublicFormPage from "@/pages/public-form-page"

export const Route = createFileRoute("/f/$slug")({
  component: PublicFormPage,
})
