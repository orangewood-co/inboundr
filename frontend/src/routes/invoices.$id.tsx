import { createFileRoute } from "@tanstack/react-router"

import InvoiceDetailPage from "@/pages/invoice-detail-page"

export const Route = createFileRoute("/invoices/$id")({
  component: InvoiceDetailPage,
})
