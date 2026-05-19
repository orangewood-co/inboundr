import { createFileRoute } from "@tanstack/react-router"

import InvoicesPage from "@/pages/invoices-page"

export const Route = createFileRoute("/invoices/")({
  component: InvoicesPage,
})
