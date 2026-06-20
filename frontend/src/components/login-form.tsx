import { useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { clearOrganizationSessionStorage } from "@/lib/auth-storage"
import { signIn } from "@/lib/auth-client"

function getInviteToken(): string | null {
  return new URLSearchParams(window.location.search).get("inviteToken")
}

function getInviteEmail(): string {
  return new URLSearchParams(window.location.search).get("email") ?? ""
}

function getInviteSearch(): { inviteToken: string; email?: string } | undefined {
  const inviteToken = getInviteToken()
  if (!inviteToken) return undefined

  const email = getInviteEmail()
  return email ? { inviteToken, email } : { inviteToken }
}

function getPostAuthPath(): string {
  const inviteToken = getInviteToken()
  return inviteToken ? `/invite/${encodeURIComponent(inviteToken)}` : "/"
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState(getInviteEmail)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const callbackURL = `${window.location.origin}${getPostAuthPath()}`
    clearOrganizationSessionStorage()
    const result = await signIn.email({ email, password, callbackURL })

    setIsSubmitting(false)

    if (result.error) {
      setError(
        result.error.message ?? "Authentication failed. Please try again.",
      )
      return
    }

    window.location.href = getPostAuthPath()
  }

  // Google sign-in is temporarily disabled until the OAuth provider is configured.
  // async function handleGoogleSignIn() {
  //   setError(null)
  //   clearOrganizationSessionStorage()
  //   await signIn.social({
  //     provider: "google",
  //     callbackURL: `${window.location.origin}${getPostAuthPath()}`,
  //   })
  // }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your inboundr.
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
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              to="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot Your Password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {isSubmitting ? "Please wait…" : "Login"}
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              search={getInviteSearch()}
              className="underline underline-offset-4"
            >
              Sign Up
            </Link>
          </FieldDescription>
        </Field>
        {/* Google sign-in temporarily disabled until the OAuth provider is configured.
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" onClick={handleGoogleSignIn}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Login with Google
          </Button>
        </Field>
        */}
      </FieldGroup>
    </form>
  )
}
