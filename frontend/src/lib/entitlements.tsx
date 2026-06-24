import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { API_ORIGIN } from "@/lib/env"

export type FeatureKey =
  | "rfq"
  | "inbox"
  | "products"
  | "customers"
  | "invoices"
  | "forms"
  | "links"
  | "drive"
  | "stats"
  | "employees"
  | "projects"
  | "chat"
  | "support"
export type EmployeeAccessModule =
  | "rfq"
  | "inbox"
  | "products"
  | "customers"
  | "invoices"
  | "forms"
  | "links"
  | "drive"
  | "stats"
  | "employees"
  | "projects"
  | "chat"
  | "support"

interface EntitlementState {
  effectiveFeatures: FeatureKey[]
  planSlug: string
  employeeAccess: {
    restricted: boolean
    enabled: boolean
    allowedModules: EmployeeAccessModule[]
    canManageOrganization: boolean
  }
}

interface EntitlementContextValue extends EntitlementState {
  loading: boolean
  hasFeature: (feature: FeatureKey) => boolean
  hasModuleAccess: (module: EmployeeAccessModule) => boolean
  canManageOrganization: boolean
  refresh: () => Promise<void>
}

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  effectiveFeatures: [
    "rfq",
    "inbox",
    "products",
    "customers",
    "invoices",
    "forms",
    "links",
    "drive",
    "stats",
    "employees",
    "projects",
    "chat",
    "support",
  ],
  planSlug: "all_features",
  employeeAccess: {
    restricted: false,
    enabled: true,
    allowedModules: [],
    canManageOrganization: true,
  },
}

const EntitlementContext = createContext<EntitlementContextValue>({
  ...DEFAULT_ENTITLEMENTS,
  loading: true,
  hasFeature: () => true,
  hasModuleAccess: () => true,
  canManageOrganization: true,
  refresh: async () => {},
})

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EntitlementState>(DEFAULT_ENTITLEMENTS)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        credentials: "include",
      })
      if (!response.ok) return
      const data = await response.json()
      if (data.entitlements?.effectiveFeatures) {
        const employeeAccess = data.employeeAccess ?? DEFAULT_ENTITLEMENTS.employeeAccess
        setState({
          effectiveFeatures: data.entitlements.effectiveFeatures,
          planSlug: data.entitlements.planSlug ?? "all_features",
          employeeAccess: {
            ...DEFAULT_ENTITLEMENTS.employeeAccess,
            ...employeeAccess,
            canManageOrganization: Boolean(employeeAccess.canManageOrganization),
          },
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = useMemo<EntitlementContextValue>(
    () => ({
      ...state,
      loading,
      hasFeature: (feature) => state.effectiveFeatures.includes(feature),
      hasModuleAccess: (module) => {
        if (!state.employeeAccess.enabled) return false
        return !state.employeeAccess.restricted || state.employeeAccess.allowedModules.includes(module)
      },
      canManageOrganization: state.employeeAccess.canManageOrganization,
      refresh,
    }),
    [loading, state]
  )

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlements() {
  return useContext(EntitlementContext)
}
