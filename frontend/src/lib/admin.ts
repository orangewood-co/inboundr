const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export async function getAdminMe(): Promise<{ isSuperAdmin: boolean }> {
  const response = await fetch(`${API_ORIGIN}/api/v1/admin/me`, {
    credentials: "include",
  })

  if (!response.ok) {
    return { isSuperAdmin: false }
  }

  return response.json()
}
