import { useMemo, useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"

import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"
import { resetPassword } from "@/lib/auth-client"

export function ResetPasswordPage() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
    [],
  )
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
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

    setIsSubmitted(true)
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
              <p className="text-sm text-balance text-muted-foreground">
                This reset link is missing a token. Request a new link to reset
                your password.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/forgot-password">Request a New Link</Link>
          </Button>
          <FieldDescription className="text-center">
            Remembered your password?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Back to Sign In
            </Link>
          </FieldDescription>
        </div>
      </AuthLayout>
    )
  }

  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Password Reset</h1>
              <p className="text-sm text-balance text-muted-foreground">
                Your password has been updated. Sign in with your new password
                to continue.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/login">Back to Sign In</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Choose a new password for your account.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <PasswordStrengthIndicator password={password} />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">
              Confirm password
            </FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
            <FieldDescription>Please confirm your password.</FieldDescription>
          </Field>
          {error ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : "Reset Password"}
            </Button>
            <FieldDescription className="text-center">
              Remembered your password?{" "}
              <Link to="/login" className="underline underline-offset-4">
                Back to Sign In
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
