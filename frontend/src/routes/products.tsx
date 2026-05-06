import { createFileRoute } from "@tanstack/react-router"

import { requireSession } from "@/lib/auth-guards"
import ProductsPage from "@/pages/products-page"

export const Route = createFileRoute("/products")({
  beforeLoad: requireSession,
  component: ProductsPage,
})
