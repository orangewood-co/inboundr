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
import { API_ORIGIN } from "@/lib/env"
import { installOrganizationFetchContext } from "@/lib/organization-context"
import { renderASCIILogo } from "@/lib/branding"
import { useAppVersionCheck } from "@/hooks/use-app-version-check"

installOrganizationFetchContext(API_ORIGIN)
renderASCIILogo()

function AppVersionCheck() {
  useAppVersionCheck()
  return null
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <OrganizationBrandingProvider>
        <EntitlementProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <AppVersionCheck />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </EntitlementProvider>
      </OrganizationBrandingProvider>
    </ThemeProvider>
  </StrictMode>
)
