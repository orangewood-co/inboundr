import { createFileRoute } from "@tanstack/react-router"

import InvoiceNewPage from "@/pages/invoice-new-page"

export const Route = createFileRoute("/invoices/new")({
  component: InvoiceNewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: (search.edit as string) || undefined,
  }),
})
