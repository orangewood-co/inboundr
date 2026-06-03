import { API_ORIGIN } from "@/lib/env"

export async function getAdminMe(): Promise<{ isSuperAdmin: boolean }> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/me`, {
    credentials: "include",
  })

  if (!response.ok) {
    return { isSuperAdmin: false }
  }

  return response.json()
}
