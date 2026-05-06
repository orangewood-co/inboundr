import { useState, type FormEvent, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/lib/auth-client"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
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

    setMessage("Check the backend console for your password reset link.")
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Recover your account"
      description="Enter your email and Better Auth will create a reset link. Emails are mocked, so the link appears in the backend console."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <Button asChild variant="ghost" className="w-full">
        <Link to="/login">Back to sign in</Link>
      </Button>
    </AuthShell>
  )
}

type AuthShellProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 sm:p-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
            {eyebrow}
          </span>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
