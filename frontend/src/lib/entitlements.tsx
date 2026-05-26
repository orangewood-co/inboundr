import { createContext, useContext, useEffect, useMemo, useState } from "react"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export type FeatureKey = "rfq" | "invoices" | "links" | "forms"

interface EntitlementState {
  effectiveFeatures: FeatureKey[]
  planSlug: string
}

interface EntitlementContextValue extends EntitlementState {
  loading: boolean
  hasFeature: (feature: FeatureKey) => boolean
  refresh: () => Promise<void>
}

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  effectiveFeatures: ["rfq", "invoices", "links", "forms"],
  planSlug: "all_features",
}

const EntitlementContext = createContext<EntitlementContextValue>({
  ...DEFAULT_ENTITLEMENTS,
  loading: true,
  hasFeature: () => true,
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
      refresh,
    }),
    [loading, state]
  )

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlements() {
  return useContext(EntitlementContext)
}
