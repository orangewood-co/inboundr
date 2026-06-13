import * as React from "react"

import { useTheme } from "@/components/theme-provider"
import { API_ORIGIN } from "@/lib/env"

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
  isPro: boolean
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

/**
 * Theme tokens are authored in oklch; converting org hex colors keeps every
 * CSS variable in the same color space (gradients/color-mix stay predictable).
 */
function hexToOklch(hexColor: string): string {
  const toLinear = (channel: number) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const r = toLinear(Number.parseInt(hexColor.slice(1, 3), 16))
  const g = toLinear(Number.parseInt(hexColor.slice(3, 5), 16))
  const b = toLinear(Number.parseInt(hexColor.slice(5, 7), 16))

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const aAxis = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const chroma = Math.sqrt(aAxis * aAxis + bAxis * bAxis)
  let hue = (Math.atan2(bAxis, aAxis) * 180) / Math.PI
  if (hue < 0) hue += 360

  return `oklch(${lightness.toFixed(4)} ${chroma.toFixed(4)} ${hue.toFixed(2)})`
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

  const primary = hexToOklch(normalized)
  const foreground = hexToOklch(readableForeground(normalized))
  variables.forEach((variable) => root.style.setProperty(variable, primary))
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
  const { previewTheme, setOrgColorTheme } = useTheme()
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
        isPro: Boolean(organization?.isPro),
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
      previewTheme(branding.theme)
    }

    setOrgColorTheme(branding?.colorTheme ?? null)
    applyPrimaryColor(branding?.primaryColor)
  }, [branding?.primaryColor, branding?.theme, branding?.colorTheme, previewTheme, setOrgColorTheme])

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
