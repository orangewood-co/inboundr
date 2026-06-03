import { redirect } from "@tanstack/react-router"

import { getSession } from "@/lib/auth-client"
import { getAdminMe } from "@/lib/admin"
import { API_ORIGIN } from "@/lib/env"
import type { EmployeeAccessModule, FeatureKey } from "@/lib/entitlements"

export async function requireSession() {
  const { data: session } = await getSession()

  if (!session) {
    throw redirect({ to: "/login" })
  }

  return session
}

export async function redirectIfAuthenticated() {
  const { data: session } = await getSession()

  if (session) {
    throw redirect({ to: "/" })
  }
}

export async function requireSuperAdmin() {
  await requireSession()
  const { isSuperAdmin } = await getAdminMe()

  if (!isSuperAdmin) {
    throw redirect({ to: "/" })
  }
}

export async function requireFeatureAccess(feature: FeatureKey) {
  await requireSession()
  const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw redirect({ to: "/" })
  }

  const data = await response.json()
  if (!data.entitlements?.effectiveFeatures?.includes(feature)) {
    throw redirect({ to: "/" })
  }
}

export async function requireModuleAccess(module: EmployeeAccessModule) {
  await requireSession()
  const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw redirect({ to: "/" })
  }

  const data = await response.json()
  const access = data.employeeAccess
  if (access && (!access.enabled || (access.restricted && !access.allowedModules?.includes(module)))) {
    throw redirect({ to: "/" })
  }
}

export async function requireFeatureAndModuleAccess(feature: FeatureKey, module: EmployeeAccessModule) {
  await requireFeatureAccess(feature)
  await requireModuleAccess(module)
}
