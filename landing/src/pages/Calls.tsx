import { FadeIn } from "@/components/FadeIn"
import { ArrowRight } from "lucide-react"

const steps = [
  { num: "01", title: "AI initiates the call", text: "Warm leads get a call within minutes of expressing interest. AI handles the greeting, qualification, and key questions." },
  { num: "02", title: "Warm handoff to your rep", text: "When a lead is qualified and ready, AI transfers the call to your human closer — with full context on screen." },
  { num: "03", title: "Automated call summaries", text: "Every call gets a structured summary: topics discussed, next steps, sentiment score. Logged to CRM automatically." },
]

export default function Calls() {
  return (
    <>
      <section className="noise grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.3em] text-green-bright">Product</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              AI Calls
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              AI voice that qualifies leads, handles objections, and hands off to your closers — with full context, zero cold calling.
            </p>
          </FadeIn>
        </div>
      </section>

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
          <FadeIn>
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                { value: "<2min", label: "Lead-to-call time" },
                { value: "40%", label: "Higher qualification rate" },
                { value: "100%", label: "Calls logged & summarized" },
              ].map((s) => (
                <div key={s.label} className="border-l border-border pl-6">
                  <p className="font-mono text-4xl font-bold text-green-bright">{s.value}</p>
                  <p className="mt-2 text-sm text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Let AI dial. Your reps close.</h2>
          <div className="mt-8 flex justify-center gap-3">
            <a href="mailto:hello@inboundr.ai?subject=Try AI Calls" className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90">
              Start free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
