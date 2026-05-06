import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AuthPageProps = {
  eyebrow: string
  title: string
  description: string
  submitLabel: string
  alternatePrompt: string
  alternateLabel: string
  alternateTo: "/login" | "/register"
}

export function AuthPage({
  eyebrow,
  title,
  description,
  submitLabel,
  alternatePrompt,
  alternateLabel,
  alternateTo,
}: AuthPageProps) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_38%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))] p-8 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-20 left-12 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-16 bottom-16 h-40 w-40 rounded-full bg-sidebar-primary/20 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <span className="inline-flex rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
            BTSA workspace
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

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/login"
                  className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" className="w-full">
              {submitLabel}
            </Button>
          </form>

          <div className="space-y-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {alternatePrompt}{" "}
              <Link
                to={alternateTo}
                className="font-medium text-primary transition-opacity hover:opacity-80"
              >
                {alternateLabel}
              </Link>
            </p>

            <Button asChild variant="outline" className="w-full">
              <Link to="/">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
