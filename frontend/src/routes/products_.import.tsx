import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProductsImportPage from "@/pages/products-import-page"

export const Route = createFileRoute("/products_/import")({
  beforeLoad: () => requireModuleAccess("products"),
  component: ProductsImportPage,
})
