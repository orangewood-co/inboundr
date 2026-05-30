import { createFileRoute } from "@tanstack/react-router"

import { requireModuleAccess } from "@/lib/auth-guards"
import ProductsPage from "@/pages/products-page"

export const Route = createFileRoute("/products")({
  beforeLoad: () => requireModuleAccess("products"),
  component: ProductsPage,
})
