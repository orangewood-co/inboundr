import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OrganizationBrandingProvider } from "@/lib/organization-branding"
import { EntitlementProvider } from "@/lib/entitlements"
import { installOrganizationFetchContext } from "@/lib/organization-context"
import { renderASCIILogo } from "@/lib/branding"

installOrganizationFetchContext(import.meta.env.VITE_API_URL ?? "http://localhost:3000")
renderASCIILogo()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <OrganizationBrandingProvider>
        <EntitlementProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </EntitlementProvider>
      </OrganizationBrandingProvider>
    </ThemeProvider>
  </StrictMode>
)
