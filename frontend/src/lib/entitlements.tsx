import { createContext, useContext, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { organizationMeQueryOptions } from "@/lib/queries"

export type FeatureKey =
  | "rfq"
  | "inbox"
  | "products"
  | "customers"
  | "crm"
  | "invoices"
  | "forms"
  | "links"
  | "drive"
  | "stats"
  | "employees"
  | "projects"
  | "chat"
  | "support"
  | "assets"
  | "service_management"
  | "recruitment"
  | "workflows"
  | "procurement"
export type EmployeeAccessModule =
  | "rfq"
  | "inbox"
  | "products"
  | "customers"
  | "crm"
  | "invoices"
  | "forms"
  | "links"
  | "drive"
  | "stats"
  | "employees"
  | "projects"
  | "chat"
  | "support"
  | "assets"
  | "service_management"
  | "recruitment"

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
    "crm",
    "invoices",
    "forms",
    "links",
    "drive",
    "stats",
    "employees",
    "projects",
    "chat",
    "support",
    "assets",
    "service_management",
    "recruitment",
    "workflows",
    "procurement",
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
  const { data, isPending, refetch } = useQuery(organizationMeQueryOptions)

  const state = useMemo<EntitlementState>(() => {
    const effectiveFeatures = data?.entitlements?.effectiveFeatures
    if (!effectiveFeatures) {
      return DEFAULT_ENTITLEMENTS
    }

    const employeeAccess = data.employeeAccess ?? DEFAULT_ENTITLEMENTS.employeeAccess
    return {
      effectiveFeatures: effectiveFeatures as FeatureKey[],
      planSlug: data.entitlements?.planSlug ?? "all_features",
      employeeAccess: {
        ...DEFAULT_ENTITLEMENTS.employeeAccess,
        ...employeeAccess,
        allowedModules: (employeeAccess.allowedModules ?? []) as EmployeeAccessModule[],
        canManageOrganization: Boolean(employeeAccess.canManageOrganization),
      },
    }
  }, [data])

  const value = useMemo<EntitlementContextValue>(
    () => ({
      ...state,
      loading: isPending,
      hasFeature: (feature) => state.effectiveFeatures.includes(feature),
      hasModuleAccess: (module) => {
        if (!state.employeeAccess.enabled) return false
        return !state.employeeAccess.restricted || state.employeeAccess.allowedModules.includes(module)
      },
      canManageOrganization: state.employeeAccess.canManageOrganization,
      refresh: async () => {
        await refetch()
      },
    }),
    [isPending, refetch, state]
  )

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

export function useEntitlements() {
  return useContext(EntitlementContext)
}
