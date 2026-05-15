import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import "./index.css"
import { router } from "./router"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { installOrganizationFetchContext } from "@/lib/organization-context"

installOrganizationFetchContext(import.meta.env.VITE_API_URL ?? "http://localhost:3000")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
