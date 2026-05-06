import { redirect } from "@tanstack/react-router"

import { getSession } from "@/lib/auth-client"

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
