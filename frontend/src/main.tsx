import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { PostHogProvider } from "@posthog/react"
import posthog from "posthog-js"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { AppVersionCheck } from "@/components/app-version-check"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OrganizationBrandingProvider } from "@/lib/organization-branding"
import { EntitlementProvider } from "@/lib/entitlements"
import { NotificationProvider } from "@/lib/notifications-context"
import { API_ORIGIN, POSTHOG_ENABLED, POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from "@/lib/env"
import { installOrganizationFetchContext } from "@/lib/organization-context"
import { renderASCIILogo } from "@/lib/branding"

if (POSTHOG_ENABLED) {
  posthog.init(POSTHOG_PROJECT_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: "2026-01-30",
  })
}

installOrganizationFetchContext(API_ORIGIN)
renderASCIILogo()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ThemeProvider>
        <OrganizationBrandingProvider>
          <EntitlementProvider>
            <TooltipProvider>
              <NotificationProvider>
                <RouterProvider router={router} />
                <AppVersionCheck />
                <Toaster richColors position="top-right" />
              </NotificationProvider>
            </TooltipProvider>
          </EntitlementProvider>
        </OrganizationBrandingProvider>
      </ThemeProvider>
    </PostHogProvider>
  </StrictMode>
)
