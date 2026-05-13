import { createFileRoute } from "@tanstack/react-router"

import FormEditorPage from "@/pages/form-editor-page"

export const Route = createFileRoute("/forms/$slug")({
  component: FormEditorPage,
})
