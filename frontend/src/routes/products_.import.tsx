import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import ProductsImportPage from "@/pages/products-import-page"

export const Route = createFileRoute("/products_/import")({
  beforeLoad: requireSession,
  component: ProductsImportPage,
})
