import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { CtaSection } from "@/components/CtaSection"

const steps = [
  { num: "01", title: "Detect intent instantly", text: "AI reads every inbound message — email, WhatsApp, web form — and classifies the intent in milliseconds." },
  { num: "02", title: "Draft a personalized reply", text: "Using your product catalog, past conversations, and tone guidelines, Inboundr composes a reply that sounds like your best rep." },
  { num: "03", title: "Send or queue for review", text: "Set confidence thresholds. High-confidence replies go out instantly. Everything else lands in a one-click approval queue." },
]

export default function AutoReply() {
  return (
    <>
      <title>Auto Reply — Inboundr</title>
      <PageHeader
        label="Product"
        title="Auto Reply"
        description="Leads get a response in seconds, not hours. AI reads intent, drafts a personalized reply, and sends it — or queues it for your review."
      />

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">How it works</p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.06}>
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
              <p className="label-sm mb-4 text-text-dim">Without Inboundr</p>
              <p className="text-2xl font-medium leading-snug text-text-muted sm:text-3xl">
                Average response time: 4.2 hours. 38% of leads never get a reply at all.
              </p>
            </FadeIn>
            <FadeIn delay={0.12}>
              <p className="label-sm mb-4 text-gold">With Inboundr</p>
              <p className="text-2xl font-bold leading-snug sm:text-3xl">
                Every lead replied to in under 60 seconds. Zero leads dropped.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      <CtaSection
        heading="Never leave a lead waiting."
        actions={[
          { label: "Start free", href: "mailto:hello@inboundr.ai?subject=Try Auto Reply", external: true, icon: "arrow-right" },
        ]}
      />
    </>
  )
}
