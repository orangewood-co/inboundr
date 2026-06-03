import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { API_ORIGIN } from "@/lib/env"

export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  plugins: [organizationClient()],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  updateUser,
} = authClient
