import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { CtaSection } from "@/components/CtaSection"

const steps = [
  { num: "01", title: "Match products from your catalog", text: "AI maps the customer's request to your product database — SKUs, specs, pricing tiers — with no manual lookup." },
  { num: "02", title: "Apply your pricing rules", text: "Volume discounts, customer tiers, regional pricing, currency conversion — all applied automatically." },
  { num: "03", title: "Deliver a quote-ready draft", text: "Your rep gets a formatted quote with line items, totals, and terms. Review, tweak if needed, send." },
]

const stats = [
  { value: "95%", label: "Quote accuracy rate" },
  { value: "3min", label: "Avg. time to quote" },
  { value: "2.4x", label: "Faster than manual" },
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
        heading="Quotes that write themselves."
        actions={[
          { label: "Start free", href: "mailto:hello@inboundr.ai?subject=Try Quotes", external: true, icon: "arrow-right" },
        ]}
      />
    </>
  )
}
