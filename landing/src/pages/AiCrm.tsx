import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ArrowRight } from "lucide-react"

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
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">How it works</p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.08}>
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

      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Your CRM should work for you.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-text-muted">
            Let AI handle the busywork. Start free, no credit card required.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a href="mailto:hello@inboundr.ai?subject=Try AI CRM" className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90">
              Start free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
