import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ArrowRight } from "lucide-react"

const steps = [
  { num: "01", title: "Match products from your catalog", text: "AI maps the customer's request to your product database — SKUs, specs, pricing tiers — with no manual lookup." },
  { num: "02", title: "Apply your pricing rules", text: "Volume discounts, customer tiers, regional pricing, currency conversion — all applied automatically." },
  { num: "03", title: "Deliver a quote-ready draft", text: "Your rep gets a formatted quote with line items, totals, and terms. Review, tweak if needed, send." },
]

export default function Quotes() {
  return (
    <>
      <PageHeader
        label="Product"
        title="AI Quote Generation"
        description="From inquiry to quote in minutes, not days. AI matches products, applies pricing rules, and drafts accurate quotes your team can send with confidence."
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
          <FadeIn>
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                { value: "95%", label: "Quote accuracy rate" },
                { value: "3min", label: "Avg. time to quote" },
                { value: "2.4x", label: "Faster than manual" },
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
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Quotes that write themselves.</h2>
          <div className="mt-8 flex justify-center gap-3">
            <a href="mailto:hello@inboundr.ai?subject=Try Quotes" className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90">
              Start free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
