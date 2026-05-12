import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ArrowRight } from "lucide-react"

const steps = [
  { num: "01", title: "Detect intent instantly", text: "AI reads every inbound message — email, WhatsApp, web form — and classifies the intent in milliseconds." },
  { num: "02", title: "Draft a personalized reply", text: "Using your product catalog, past conversations, and tone guidelines, Inboundr composes a reply that sounds like your best rep." },
  { num: "03", title: "Send or queue for review", text: "Set confidence thresholds. High-confidence replies go out instantly. Everything else lands in a one-click approval queue." },
]

export default function AutoReply() {
  return (
    <>
      <PageHeader
        label="Product"
        title="Auto Reply"
        description="Leads get a response in seconds, not hours. AI reads intent, drafts a personalized reply, and sends it — or queues it for your review."
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
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-text-dim">Without Inboundr</p>
              <p className="text-2xl font-medium leading-snug text-text-muted sm:text-3xl">
                Average response time: 4.2 hours. 38% of leads never get a reply at all.
              </p>
            </FadeIn>
            <FadeIn delay={0.12}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-gold">With Inboundr</p>
              <p className="text-2xl font-bold leading-snug sm:text-3xl">
                Every lead replied to in under 60 seconds. Zero leads dropped.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Never leave a lead waiting.</h2>
          <div className="mt-8 flex justify-center gap-3">
            <a href="mailto:hello@inboundr.ai?subject=Try Auto Reply" className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90">
              Start free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
