import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProductsImportPage from "@/pages/products-import-page"

export const Route = createFileRoute("/products_/import")({
  beforeLoad: () => requireFeatureAndModuleAccess("products", "products"),
  component: ProductsImportPage,
})
