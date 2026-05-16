import { useState } from "react"
import { Link, type ErrorComponentProps } from "@tanstack/react-router"
import { ChevronDownIcon, RefreshCwIcon, LayoutDashboardIcon, SearchXIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function ErrorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,oklch(from_var(--primary)_l_c_h/0.08),transparent_50%),radial-gradient(circle_at_70%_80%,oklch(from_var(--sidebar-primary)_l_c_h/0.06),transparent_50%),var(--background)]">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[15%] left-[10%] h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[12%] bottom-[18%] h-48 w-48 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="absolute top-[60%] left-[55%] h-24 w-24 rounded-full bg-destructive/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 py-16">
        {children}
      </div>
    </div>
  )
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const [showDetails, setShowDetails] = useState(false)

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred."
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <ErrorLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <span className="text-2xl font-semibold text-destructive">!</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
            The page ran into an error it couldn't recover from. You can try
            reloading, or head back to a safe page.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-2xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
          {message}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCwIcon data-icon="inline-start" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <LayoutDashboardIcon data-icon="inline-start" />
              Dashboard
            </Link>
          </Button>
        </div>

        {stack ? (
          <div className="mx-auto max-w-md text-left">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon
                className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
              Technical details
            </button>

            {showDetails ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl border bg-muted/50 p-3 text-[11px] leading-5 text-muted-foreground">
                {stack}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </ErrorLayout>
  )
}

export function NotFoundPage() {
  return (
    <ErrorLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <SearchXIcon className="size-7 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
            The page you're looking for doesn't exist or may have been moved.
            Let's get you back on track.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link to="/">
              <LayoutDashboardIcon data-icon="inline-start" />
              Go to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </ErrorLayout>
  )
}
