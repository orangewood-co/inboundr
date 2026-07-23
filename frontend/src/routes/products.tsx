import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProductsPage from "@/pages/products-page"

export type ProductsSearch = {
  search?: string
}

export const Route = createFileRoute("/products")({
  beforeLoad: () => requireFeatureAndModuleAccess("products", "products"),
  validateSearch: (search: Record<string, unknown>): ProductsSearch => ({
    search: typeof search.search === "string" ? search.search : undefined,
  }),
  component: ProductsPage,
})
