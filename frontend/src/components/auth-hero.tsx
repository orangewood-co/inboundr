/**
 * Brand panel for the auth screens. Replaces the previous externally-hosted
 * stock photo with a theme-aware gradient, so the first screen a user sees
 * follows the product's own visual language.
 */
export function AuthHero() {
  return (
    <div className="relative hidden overflow-hidden border-l bg-muted lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_42%),linear-gradient(135deg,var(--background),var(--muted))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_36%)]" />
      <div className="relative flex h-full flex-col justify-end p-10">
        <div className="max-w-md space-y-3">
          <p className="text-2xl font-semibold tracking-tight">
            Every RFQ, quote, and invoice in one place.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Inboundr turns inbound emails into a sales pipeline your whole team
            can run — from first request to paid invoice.
          </p>
        </div>
      </div>
    </div>
  )
}
