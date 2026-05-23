import * as React from "react"

import { useTheme } from "@/components/theme-provider"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const DEFAULT_PRIMARY_COLOR = "#f5b400"
const BRANDING_CHANGED_EVENT = "btsa:organization-branding-changed"
const BRANDING_CACHE_KEY = "organization-branding"

type OrganizationTheme = "dark" | "light"

interface OrganizationBranding {
  organizationId: string
  name: string
  logoUrl: string
  logoDisplayUrl: string
  primaryColor: string
  theme: OrganizationTheme
  colorTheme: string
}

interface OrganizationBrandingContextValue {
  branding: OrganizationBranding | null
  loading: boolean
  refreshBranding: () => Promise<void>
}

const OrganizationBrandingContext = React.createContext<
  OrganizationBrandingContextValue | undefined
>(undefined)

function normalizeHexColor(value: string | null | undefined): string | null {
  const color = value?.trim()
  if (!color) {
    return null
  }

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toLowerCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  return null
}

function readableForeground(hexColor: string): string {
  const normalized = normalizeHexColor(hexColor) ?? DEFAULT_PRIMARY_COLOR
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

  return luminance > 0.58 ? "#1f1600" : "#ffffff"
}

function applyPrimaryColor(primaryColor: string | null | undefined) {
  const root = document.documentElement
  const normalized = normalizeHexColor(primaryColor)
  const variables = [
    "--primary",
    "--sidebar-primary",
    "--chart-1",
    "--chart-2",
    "--ring",
  ]

  if (!normalized) {
    variables.forEach((variable) => root.style.removeProperty(variable))
    root.style.removeProperty("--primary-foreground")
    root.style.removeProperty("--sidebar-primary-foreground")
    return
  }

  const foreground = readableForeground(normalized)
  variables.forEach((variable) => root.style.setProperty(variable, normalized))
  root.style.setProperty("--primary-foreground", foreground)
  root.style.setProperty("--sidebar-primary-foreground", foreground)
}

async function resolveLogoDisplayUrl(logoUrl: string): Promise<string> {
  const source = logoUrl.trim()
  if (!source || /^https?:\/\//i.test(source)) {
    return source
  }

  const response = await fetch(
    `${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(source)}`,
    { credentials: "include" }
  )
  const data: { url?: string; error?: string } = await response.json().catch(() => ({}))

  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to load organization logo")
  }

  return data.url
}

function readCachedBranding(): OrganizationBranding | null {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.organizationId === "string" && parsed.primaryColor) {
      return parsed as OrganizationBranding
    }
  } catch {
    // Corrupted cache — ignore
  }
  return null
}

function writeCachedBranding(branding: OrganizationBranding) {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding))
  } catch {
    // Storage full or unavailable — not critical
  }
}

function clearCachedBranding() {
  try {
    localStorage.removeItem(BRANDING_CACHE_KEY)
  } catch {
    // Not critical
  }
}

export function notifyOrganizationBrandingChanged() {
  window.dispatchEvent(new Event(BRANDING_CHANGED_EVENT))
}

export function OrganizationBrandingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { setTheme, setOrgColorTheme } = useTheme()
  const [branding, setBranding] = React.useState<OrganizationBranding | null>(readCachedBranding)
  const [loading, setLoading] = React.useState(true)

  const refreshBranding = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        credentials: "include",
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load organization branding")
      }

      const organization = data?.organization
      const logoUrl = organization?.logoUrl ?? ""

      const freshBranding: OrganizationBranding = {
        organizationId: organization?._id ?? "",
        name: organization?.name ?? "",
        logoUrl,
        logoDisplayUrl: await resolveLogoDisplayUrl(logoUrl),
        primaryColor:
          normalizeHexColor(organization?.preferences?.primaryColor) ??
          DEFAULT_PRIMARY_COLOR,
        theme: organization?.preferences?.theme === "light" ? "light" : "dark",
        colorTheme: organization?.preferences?.colorTheme ?? "default",
      }

      setBranding(freshBranding)
      writeCachedBranding(freshBranding)
    } catch (error) {
      console.error("Failed to load organization branding", error)
      setBranding(null)
      clearCachedBranding()
      applyPrimaryColor(null)
      setOrgColorTheme(null)
    } finally {
      setLoading(false)
    }
  }, [setOrgColorTheme])

  React.useEffect(() => {
    void refreshBranding()
  }, [refreshBranding])

  React.useEffect(() => {
    const handleBrandingChanged = () => {
      void refreshBranding()
    }

    window.addEventListener(BRANDING_CHANGED_EVENT, handleBrandingChanged)
    window.addEventListener("storage", handleBrandingChanged)

    return () => {
      window.removeEventListener(BRANDING_CHANGED_EVENT, handleBrandingChanged)
      window.removeEventListener("storage", handleBrandingChanged)
    }
  }, [refreshBranding])

  React.useEffect(() => {
    if (branding?.theme) {
      setTheme(branding.theme)
    }

    setOrgColorTheme(branding?.colorTheme ?? null)
    applyPrimaryColor(branding?.primaryColor)
  }, [branding?.primaryColor, branding?.theme, branding?.colorTheme, setTheme, setOrgColorTheme])

  const value = React.useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
    }),
    [branding, loading, refreshBranding]
  )

  return (
    <OrganizationBrandingContext.Provider value={value}>
      {children}
    </OrganizationBrandingContext.Provider>
  )
}

export function useOrganizationBranding() {
  const context = React.useContext(OrganizationBrandingContext)

  if (context === undefined) {
    throw new Error(
      "useOrganizationBranding must be used within OrganizationBrandingProvider"
    )
  }

  return context
}
