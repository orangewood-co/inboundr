import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth-client"
import { setActiveOrganizationId } from "@/lib/organization-context"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

interface InvitationPreview {
  email: string
  role: "owner" | "admin" | "member"
  status: "pending" | "accepted" | "cancelled" | "expired"
  expiresAt: string
  organization: {
    _id: string
    name: string
  }
  inviter: {
    name: string
    email: string
  }
}

function inviterLabel(invitation: InvitationPreview): string {
  return invitation.inviter.name || invitation.inviter.email || "A teammate"
}

export function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" })
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadInvitation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [previewRes, sessionRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/organization/invitations/preview?token=${encodeURIComponent(token)}`),
        getSession(),
      ])

      const data = await previewRes.json().catch(() => null)
      if (!previewRes.ok) throw new Error(data?.error || "Invitation not found")

      setInvitation(data.invitation)
      setSessionEmail(sessionRes.data?.user?.email?.toLowerCase() ?? null)
    } catch (err: any) {
      setError(err.message || "Failed to load invitation")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadInvitation()
  }, [loadInvitation])

  const acceptInvitation = async () => {
    setAccepting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/invitations/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to accept invitation")
      if (data?.organizationId) setActiveOrganizationId(String(data.organizationId))
      setMessage("Invitation accepted. Taking you to your workspace...")
      window.setTimeout(() => {
        window.location.href = "/settings"
      }, 700)
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation")
    } finally {
      setAccepting(false)
    }
  }

  const inviteQuery = `?inviteToken=${encodeURIComponent(token)}`
  const signedInWithWrongEmail =
    invitation && sessionEmail && sessionEmail !== invitation.email.toLowerCase()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-sm">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invitation...</p>
        ) : error && !invitation ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline">
              <Link to="/login">Go to login</Link>
            </Button>
          </div>
        ) : invitation ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                Workspace invitation
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Join {invitation.organization.name}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  You were invited by {inviterLabel(invitation)} as a{" "}
                  <span className="font-medium text-foreground">{invitation.role}</span>.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">{invitation.email}</p>
              <p className="mt-1 text-muted-foreground">
                Expires {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>

            {invitation.status !== "pending" ? (
              <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                This invitation is {invitation.status}.
              </p>
            ) : signedInWithWrongEmail ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                You are signed in as {sessionEmail}. Sign in with {invitation.email} to accept this invitation.
              </p>
            ) : error ? (
              <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : message ? (
              <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {message}
              </p>
            ) : null}

            {invitation.status === "pending" && (
              <div className="grid gap-3">
                {sessionEmail && !signedInWithWrongEmail ? (
                  <Button onClick={acceptInvitation} disabled={accepting}>
                    {accepting ? "Accepting..." : "Accept invitation"}
                  </Button>
                ) : (
                  <>
                    <Button asChild>
                      <Link to="/login" search={{ inviteToken: token }}>
                        Sign in to accept
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/register" search={{ inviteToken: token }}>
                        Create account
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default InvitePage
