import { useMemo, useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { resetPassword } from "@/lib/auth-client"

export function ResetPasswordPage() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
    [],
  )
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!token) {
      setError("This reset link is missing a token. Request a new reset link.")
      return
    }

    setIsSubmitting(true)
    const result = await resetPassword({
      newPassword: password,
      token,
    })
    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message ?? "Could not reset your password.")
      return
    }

    setMessage("Password reset. You can sign in with your new password.")
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 sm:p-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
            New password
          </span>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Reset your password
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Enter a new password for your BTSA account.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Reset password
          </Button>
        </form>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  )
}
