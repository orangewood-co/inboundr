import { useMemo, useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn, signUp } from "@/lib/auth-client"

function getInviteToken(): string | null {
  return new URLSearchParams(window.location.search).get("inviteToken")
}

function getPostAuthPath(): string {
  const inviteToken = getInviteToken()
  return inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/"
}

const STRENGTH_CONFIG = [
  { label: "Too short", color: "bg-destructive" },
  { label: "Weak", color: "bg-orange-500" },
  { label: "Fair", color: "bg-amber-500" },
  { label: "Good", color: "bg-emerald-400" },
  { label: "Strong", color: "bg-emerald-500" },
] as const

function getPasswordStrength(password: string): number {
  if (password.length === 0) return -1
  if (password.length < 8) return 0

  let score = 0
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (password.length >= 12) score++

  return Math.min(score, 4)
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = useMemo(() => getPasswordStrength(password), [password])
  if (strength < 0) return null

  const config = STRENGTH_CONFIG[strength]

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= strength ? config.color : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", strength <= 1 ? "text-destructive" : "text-muted-foreground")}>
        {config.label}
      </p>
    </div>
  )
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    const callbackURL = `${window.location.origin}${getPostAuthPath()}`
    const result = await signUp.email({ email, password, name, callbackURL })

    setIsSubmitting(false)

    if (result.error) {
      setError(
        result.error.message ?? "Registration failed. Please try again.",
      )
      return
    }

    setIsAwaitingVerification(true)
  }

  async function handleGoogleSignIn() {
    setError(null)
    await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${getPostAuthPath()}`,
    })
  }

  if (isAwaitingVerification) {
    return (
      <div className={cn("flex flex-col gap-6 text-center", className)}>
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
            <h1 className="text-2xl font-bold">Check your mail</h1>
            <p className="text-sm text-balance text-muted-foreground">
              We sent a verification link to {email}. Open it to activate your
              account before signing in.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link
            to="/login"
            search={getInviteToken() ? { inviteToken: getInviteToken() } : undefined}
          >
            Back to sign in
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Fill in the form below to create your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
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
          <FieldDescription>
            We&apos;ll use this to contact you. We will not share your email
            with anyone else.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
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
          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
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
            {isSubmitting ? "Please wait…" : "Create Account"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Sign up with Google
          </Button>
          <FieldDescription className="px-6 text-center">
            Already have an account?{" "}
            <Link
              to="/login"
              search={getInviteToken() ? { inviteToken: getInviteToken() } : undefined}
              className="underline underline-offset-4"
            >
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
