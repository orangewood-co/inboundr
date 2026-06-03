import { useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { signIn, signUp } from "@/lib/auth-client"

type AuthPageProps = {
  mode: "login" | "register"
  eyebrow: string
  title: string
  description: string
  submitLabel: string
  alternatePrompt: string
  alternateLabel: string
  alternateTo: "/login" | "/register"
}

export function AuthPage({
  mode,
  eyebrow,
  title,
  description,
  submitLabel,
  alternatePrompt,
  alternateLabel,
  alternateTo,
}: AuthPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setStatus(null)
    setIsSubmitting(true)

    const callbackURL = `${window.location.origin}/`
    const result =
      mode === "login"
        ? await signIn.email({ email, password, callbackURL })
        : await signUp.email({ email, password, name, callbackURL })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message ?? "Authentication failed. Please try again.")
      return
    }

    if (mode === "register") {
      setStatus("Account created. Check the backend console for your verification link before signing in.")
      return
    }

    window.location.href = "/"
  }

  async function handleGoogleSignIn() {
    setError(null)
    await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    })
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_38%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))] p-8 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-20 left-12 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-16 bottom-16 h-40 w-40 rounded-full bg-sidebar-primary/20 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <span className="inline-flex rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
            BTSA Workspace
          </span>
          <h1 className="max-w-sm text-4xl font-semibold tracking-tight">
            Built for calm operations and clear decisions.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The auth flow is intentionally separate from the application shell,
            so login and registration stay focused while the main workspace
            keeps the full sidebar experience.
          </p>
        </div>

        <div className="relative z-10 grid gap-4">
          <article className="rounded-3xl border bg-background/75 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              What you get
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-muted/70 px-4 py-3">
                Dedicated auth routes without sidebar chrome
              </div>
              <div className="rounded-2xl bg-muted/70 px-4 py-3">
                TanStack Router powering route-level app structure
              </div>
              <div className="rounded-2xl bg-muted/70 px-4 py-3">
                A clean transition back into the main workspace shell
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-8">
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Tushar Gaurav"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            ) : null}

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" ? (
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
                  >
                    Forgot Password?
                  </Link>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Enter your password"
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

            {status ? (
              <p className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                {status}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </form>

          <div className="space-y-4 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </Button>

            <p className="text-sm text-muted-foreground">
              {alternatePrompt}{" "}
              <Link
                to={alternateTo}
                className="font-medium text-primary transition-opacity hover:opacity-80"
              >
                {alternateLabel}
              </Link>
            </p>

            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
