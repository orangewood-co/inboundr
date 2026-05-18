import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { CtaSection } from "@/components/CtaSection"

const steps = [
  { num: "01", title: "AI initiates the call", text: "Warm leads get a call within minutes of expressing interest. AI handles the greeting, qualification, and key questions." },
  { num: "02", title: "Warm handoff to your rep", text: "When a lead is qualified and ready, AI transfers the call to your human closer — with full context on screen." },
  { num: "03", title: "Automated call summaries", text: "Every call gets a structured summary: topics discussed, next steps, sentiment score. Logged to CRM automatically." },
]

const stats = [
  { value: "<2min", label: "Lead-to-call time" },
  { value: "40%", label: "Higher qualification rate" },
  { value: "100%", label: "Calls logged & summarized" },
]

export default function Calls() {
  return (
    <>
      <title>AI Calls — Inboundr</title>
      <PageHeader
        label="Product"
        title="AI Calls"
        description="AI voice that qualifies leads, handles objections, and hands off to your closers — with full context, zero cold calling."
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
          <FadeIn>
            <div className="grid gap-8 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="border-l border-border pl-6">
                  <p className="font-mono text-4xl font-bold text-green-bright">{s.value}</p>
                  <p className="mt-2 text-sm text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <CtaSection
        heading="Let AI dial. Your reps close."
        actions={[
          { label: "Start free", href: "mailto:hello@inboundr.ai?subject=Try AI Calls", external: true, icon: "arrow-right" },
        ]}
      />
    </>
  )
}
