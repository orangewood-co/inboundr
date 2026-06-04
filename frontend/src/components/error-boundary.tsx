import { useState } from "react"
import { Link, type ErrorComponentProps } from "@tanstack/react-router"
import { ChevronDownIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function ErrorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6 py-20">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        {children}
      </div>
    </div>
  )
}

function CableIllustration({ variant }: { variant: "error" | "missing" }) {
  const sparkColor =
    variant === "error" ? "text-destructive" : "text-primary"

  return (
    <svg
      viewBox="0 0 720 200"
      fill="none"
      className="w-full max-w-md text-foreground"
      role="img"
      aria-hidden
    >
      {/* Cable coming in from the left, sagging into the critter's mouth */}
      <path
        d="M0 96 C 120 96, 170 70, 250 118 C 300 148, 330 150, 360 138"
        className="text-border"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Cable continuing out to the right, with a severed gap */}
      <path
        d="M438 128 C 520 150, 560 116, 660 110 C 690 108, 710 106, 720 104"
        className="text-border"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Frayed cable tip near the spark */}
      <path
        d="M438 128 l 14 -6 M438 128 l 12 6 M438 128 l 16 1"
        className={sparkColor}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Little spark/zap where the cable was nibbled through */}
      <path
        d="M404 96 l 10 -22 l -3 16 l 12 -4 l -14 22 l 4 -14 z"
        className={sparkColor}
        fill="currentColor"
      />

      {/* Rabbit silhouette perched on the cable, nibbling the cut */}
      <path
        fill="currentColor"
        d="M362 146
           c -6 0 -12 -2 -16 -7
           c -5 -6 -7 -14 -6 -22
           c 1 -8 5 -15 11 -20
           c -4 -10 -6 -22 -4 -33
           c 1 -6 8 -7 11 -2
           c 4 7 7 15 8 23
           c 4 -2 9 -3 13 -3
           c -1 -9 -1 -20 3 -29
           c 2 -6 9 -5 11 1
           c 3 9 3 20 1 30
           c 7 4 12 11 14 19
           c 2 9 0 19 -5 26
           c -6 8 -16 12 -26 13
           c -7 1 -14 4 -20 4 z"
      />
      {/* Eye notch (background-colored) to read as a face */}
      <circle cx="376" cy="116" r="2.4" className="text-background" fill="currentColor" />
    </svg>
  )
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const [showDetails, setShowDetails] = useState(false)

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred."
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <ErrorLayout>
      <CableIllustration variant="error" />

      <div className="mt-10 flex flex-col items-center text-center">
        <h1 className="text-4xl font-light tracking-tight sm:text-5xl">
          Something Went Wrong
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          The wires got crossed and this page couldn't load. You can try again,
          or head back to the{" "}
          <Link
            to="/"
            className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          .
        </p>

        <div className="mt-8">
          <Button onClick={reset}>
            <RefreshCwIcon data-icon="inline-start" />
            Try Again
          </Button>
        </div>

        {stack ? (
          <div className="mt-10 w-full max-w-md text-left">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon
                className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
              Technical Details
            </button>

            {showDetails ? (
              <pre className="mt-3 max-h-48 overflow-auto rounded-xl border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
                {message}
                {"\n\n"}
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
      <CableIllustration variant="missing" />

      <div className="mt-10 flex flex-col items-center text-center">
        <h1 className="text-4xl font-light tracking-tight sm:text-5xl">
          Page Not Found
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Something nibbled through the cables again and this page wandered off.
          Let's get you back to the{" "}
          <Link
            to="/"
            className="text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          .
        </p>
      </div>
    </ErrorLayout>
  )
}
