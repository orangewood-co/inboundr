import { redirect } from "@tanstack/react-router"

import { getSession } from "@/lib/auth-client"
import { getAdminMe } from "@/lib/admin"
import type { FeatureKey } from "@/lib/entitlements"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

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
