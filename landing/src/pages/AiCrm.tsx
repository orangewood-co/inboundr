import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { CtaSection } from "@/components/CtaSection"

const steps = [
  { num: "01", title: "Every lead, one place", text: "Emails, WhatsApp messages, website chats, and phone inquiries — all captured and unified in a single timeline." },
  { num: "02", title: "Auto-enriched profiles", text: "Inboundr pulls company data, past interactions, and buying signals so your reps never start cold." },
  { num: "03", title: "Pipeline that updates itself", text: "Deals move through stages automatically based on AI actions — replies sent, quotes delivered, follow-ups completed." },
]

const stats = [
  { value: "100%", label: "Lead capture rate" },
  { value: "0", label: "Manual data entry" },
  { value: "24/7", label: "Pipeline visibility" },
]

export default function AiCrm() {
  return (
    <>
      <PageHeader
        label="Product"
        title="AI-powered CRM"
        description="A CRM that fills itself. Every inbound lead is captured, enriched, and tracked — without your team touching a spreadsheet."
      />

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">How it works</p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.06}>
              <div className="group flex gap-6 border-b border-border py-8 sm:gap-10">
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
          <div className="grid gap-8 sm:grid-cols-3">
            {stats.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.1}>
                <div className="border-l border-border pl-6">
                  <p className="font-mono text-4xl font-bold text-green-bright">{s.value}</p>
                  <p className="mt-2 text-sm text-text-muted">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        heading="Your CRM should work for you."
        description="Let AI handle the busywork. Start free, no credit card required."
        actions={[
          { label: "Start free", href: "mailto:hello@inboundr.ai?subject=Try AI CRM", external: true, icon: "arrow-right" },
        ]}
      />
    </>
  )
}
