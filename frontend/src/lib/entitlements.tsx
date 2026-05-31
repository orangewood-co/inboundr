import { createContext, useContext, useEffect, useMemo, useState } from "react"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export type FeatureKey = "rfq" | "invoices" | "links" | "forms" | "drive"
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

interface EntitlementState {
  effectiveFeatures: FeatureKey[]
  planSlug: string
  employeeAccess: {
    restricted: boolean
    enabled: boolean
    allowedModules: EmployeeAccessModule[]
  }
}

interface EntitlementContextValue extends EntitlementState {
  loading: boolean
  hasFeature: (feature: FeatureKey) => boolean
  hasModuleAccess: (module: EmployeeAccessModule) => boolean
  refresh: () => Promise<void>
}

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  effectiveFeatures: ["rfq", "invoices", "links", "forms", "drive"],
  planSlug: "all_features",
  employeeAccess: {
    restricted: false,
    enabled: true,
    allowedModules: [],
  },
}

const EntitlementContext = createContext<EntitlementContextValue>({
  ...DEFAULT_ENTITLEMENTS,
  loading: true,
  hasFeature: () => true,
  hasModuleAccess: () => true,
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
        setState({
          effectiveFeatures: data.entitlements.effectiveFeatures,
          planSlug: data.entitlements.planSlug ?? "all_features",
          employeeAccess: data.employeeAccess ?? DEFAULT_ENTITLEMENTS.employeeAccess,
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
      refresh,
    }),
    [loading, state]
  )

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlements() {
  return useContext(EntitlementContext)
}
