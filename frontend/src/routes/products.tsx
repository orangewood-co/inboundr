import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProductsPage from "@/pages/products-page"

export const Route = createFileRoute("/products")({
  beforeLoad: () => requireFeatureAndModuleAccess("products", "products"),
  component: ProductsPage,
})
