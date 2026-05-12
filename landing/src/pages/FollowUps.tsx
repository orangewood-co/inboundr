import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ArrowRight } from "lucide-react"

const steps = [
  { num: "01", title: "Scheduled sequences", text: "AI creates follow-up cadences based on deal stage, lead temperature, and past engagement — not arbitrary timers." },
  { num: "02", title: "Multi-channel outreach", text: "Email, WhatsApp, SMS. Inboundr picks the channel the lead is most responsive on." },
  { num: "03", title: "Persistent until conversion", text: "No lead falls through the cracks. AI adjusts messaging, timing, and urgency until the deal closes or the lead explicitly opts out." },
]

export default function FollowUps() {
  return (
    <>
      <PageHeader
        label="Product"
        title="AI Follow-ups"
        description="Relentless, intelligent follow-up that never annoys. AI sequences across email, WhatsApp, and SMS until the deal moves."
      />

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">How it works</p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.08}>
              <div className="flex gap-6 border-b border-border py-8 sm:gap-10">
                <span className="shrink-0 font-mono text-xs text-text-dim">{s.num}</span>
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">{s.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-muted">{s.text}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <FadeIn>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-text-dim">The reality</p>
              <p className="text-2xl font-medium leading-snug text-text-muted sm:text-3xl">
                80% of sales require 5+ follow-ups. Most reps stop after 2.
              </p>
            </FadeIn>
            <FadeIn delay={0.12}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-gold">Inboundr's approach</p>
              <p className="text-2xl font-bold leading-snug sm:text-3xl">
                AI follows up as many times as needed, adapting tone and channel every time.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">No lead left behind.</h2>
          <div className="mt-8 flex justify-center gap-3">
            <a href="mailto:hello@inboundr.ai?subject=Try Follow-ups" className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90">
              Start free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
