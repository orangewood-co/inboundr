import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProductsDuplicatesPage from "@/pages/products-duplicates-page"

export const Route = createFileRoute("/products_/duplicates")({
  beforeLoad: () => requireFeatureAndModuleAccess("products", "products"),
  component: ProductsDuplicatesPage,
})
