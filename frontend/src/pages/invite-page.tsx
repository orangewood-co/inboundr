import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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

function roleLabel(role: InvitationPreview["role"]): string {
  return role === "admin" ? "Admin" : role === "owner" ? "Owner" : "Member"
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

  const signedInWithWrongEmail =
    invitation && sessionEmail && sessionEmail !== invitation.email.toLowerCase()
  const authSearch = invitation
    ? { inviteToken: token, email: invitation.email }
    : { inviteToken: token }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#07090a] px-6 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,hsl(var(--primary)/0.18),transparent_28%),radial-gradient(circle_at_80%_70%,hsl(var(--sidebar-primary)/0.16),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-card/95 p-8 shadow-2xl shadow-black/40 backdrop-blur sm:p-10">
        {loading ? (
          <div className="space-y-4">
            <div className="h-5 w-36 animate-pulse rounded-full bg-muted" />
            <div className="h-10 w-3/4 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted/70" />
          </div>
        ) : error && !invitation ? (
          <div className="space-y-5">
            <span className="inline-flex rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
              Invite unavailable
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">This invitation can’t be opened</h1>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/login">Go to login</Link>
            </Button>
          </div>
        ) : invitation ? (
          <div className="space-y-7">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Workspace invitation
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                  {roleLabel(invitation.role)}
                </span>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Join {invitation.organization.name}
                </h1>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {inviterLabel(invitation)} invited you to collaborate in this workspace.
                  Create your account with the invited email to continue.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Invited email
                </p>
                <p className="mt-1 font-semibold">{invitation.email}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/60 px-4 py-3 sm:text-right">
                <p className="text-xs text-muted-foreground">Expires</p>
                <p className="font-medium">{new Date(invitation.expiresAt).toLocaleDateString()}</p>
              </div>
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
                  <Button size="lg" onClick={acceptInvitation} disabled={accepting}>
                    {accepting && <Spinner data-icon="inline-start" />}
                    Accept invitation
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link to="/register" search={authSearch}>
                        Create account
                      </Link>
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        search={authSearch}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Sign in
                      </Link>
                    </p>
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
