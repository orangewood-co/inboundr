import { useState, type FormEvent } from "react"
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
import { requestPasswordReset } from "@/lib/auth-client"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message ?? "Could not start password reset.")
      return
    }

    setIsSubmitted(true)
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
                <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                <rect width="20" height="16" x="2" y="4" rx="2" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Check Your Mail</h1>
              <p className="text-sm text-balance text-muted-foreground">
                If an account exists for {email}, we sent it a password reset
                link. Open it to choose a new password.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
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
            <h1 className="text-2xl font-bold">Forgot Your Password?</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : "Send Reset Link"}
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
