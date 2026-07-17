import { createFileRoute } from "@tanstack/react-router"

import { requireFeatureAndModuleAccess } from "@/lib/auth-guards"
import ProductsSettingsPage from "@/pages/products-settings-page"

export const Route = createFileRoute("/products_/settings")({
  beforeLoad: () => requireFeatureAndModuleAccess("products", "products"),
  component: ProductsSettingsPage,
})
