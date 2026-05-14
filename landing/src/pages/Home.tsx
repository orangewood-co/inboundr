import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { AuroraBackground } from "@/components/AuroraBackground"
import { FadeIn } from "@/components/FadeIn"

const features = [
  { num: "01", text: "AI reads inbound leads" },
  { num: "02", text: "AI replies instantly" },
  { num: "03", text: "AI generates quotes" },
  { num: "04", text: "AI follows up" },
  { num: "05", text: "AI calls leads" },
  { num: "06", text: "AI chats on website & WhatsApp" },
]

const testimonials = [
  {
    quote: "Inboundr replies to leads faster than our best rep. Quotes come back 95% ready to send.",
    who: "VP Sales, Industrial MFG",
    bg: "#1a5c3a",
  },
  {
    quote: "We stopped losing leads overnight. Inboundr handles the entire flow — reply, quote, follow-up.",
    who: "Sales Ops, Distribution Co.",
    bg: "#8a6d1b",
  },
  {
    quote: "Like having a sales team that works 24/7. Instant replies, accurate quotes, persistent follow-ups.",
    who: "CRO, Precision Parts",
    bg: "#1a6a5c",
  },
]

function RevealLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.5"],
  })
  const words = text.split(" ")
  return (
    <span ref={ref} className="inline">
      {words.map((w, i) => (
        <RevealWord key={`${w}-${i}`} word={w} i={i} total={words.length} progress={scrollYProgress} />
      ))}
    </span>
  )
}

function RevealWord({
  word,
  i,
  total,
  progress,
}: {
  word: string
  i: number
  total: number
  progress: ReturnType<typeof useScroll>["scrollYProgress"]
}) {
  const opacity = useTransform(progress, [i / total, (i + 1) / total], [0.15, 1])
  return (
    <motion.span className="inline-block whitespace-pre" style={{ opacity }}>
      {word}{" "}
    </motion.span>
  )
}

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <AuroraBackground className="noise overflow-hidden">
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-28 text-center sm:pb-36 sm:pt-40 lg:px-8">
          <motion.p
            className="mb-5 text-[13px] font-medium uppercase tracking-[0.3em] text-green-bright"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AI-native sales infrastructure
          </motion.p>
          <motion.h1
            className="mx-auto max-w-4xl text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.95] tracking-[-0.045em]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Turn inbound
            <br />
            into revenue.
          </motion.h1>
          <motion.p
            className="mx-auto mt-8 max-w-xl leading-relaxed text-text-muted sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
          Inboundr combines AI automation, inbound qualification, quote generation, form infrastructure, and outreach into a single sales operating system.
          </motion.p>
          <motion.div
            className="mt-10 flex justify-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <a
              href="mailto:hello@inboundr.ai?subject=Try Inboundr"
              className="bg-text px-6 py-3 text-sm font-semibold text-base transition hover:bg-text/90"
            >
              Try Now
            </a>
            <a
              href="mailto:hello@inboundr.ai?subject=Contact Sales"
              className="border border-border px-6 py-3 text-sm font-medium transition hover:border-text/20 hover:bg-surface"
            >
              Book a Demo
            </a>
          </motion.div>
        </div>
      </AuroraBackground>

      {/* ── Feature strip ── */}
      <section id="features" className="border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-8">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">
              What it does
            </p>
          </FadeIn>
          <div className="space-y-0">
            {features.map((f, i) => (
              <FadeIn key={f.num} delay={i * 0.06}>
                <div className="group flex items-baseline gap-6 border-b border-border py-5 transition-colors hover:border-text/15 sm:gap-8">
                  <span className="shrink-0 font-mono text-xs text-text-dim">{f.num}</span>
                  <span className="text-xl font-medium tracking-[-0.01em] text-text-muted transition-colors group-hover:text-text sm:text-2xl lg:text-3xl">
                    {f.text}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem / Solution ── */}
      <section className="border-b border-border px-6 py-24 sm:py-36 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <FadeIn>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-text-dim">The problem</p>
              <h2 className="text-2xl font-medium leading-snug text-text-muted sm:text-3xl lg:text-4xl">
                Your team wastes time replying, quoting, and chasing leads.
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-gold">The solution</p>
              <h2 className="text-2xl font-bold leading-snug sm:text-3xl lg:text-4xl">
                We handle it instantly with AI.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-text-muted">
                Inboundr plugs into your inbox, website, and WhatsApp.
                It reads every inquiry, drafts quotes from your catalog,
                follows up on open threads, and even calls warm leads.
                Your reps focus on closing.
              </p>
              <a
                href="https://app.inboundr.co/"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-green-bright transition hover:text-text"
              >
                See it in action <ArrowUpRight className="size-3.5" />
              </a>
         
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Proof ── */}
      <section id="proof" className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">What teams say</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="noise relative overflow-hidden p-7 sm:p-8" style={{ backgroundColor: t.bg }}>
                  <blockquote className="relative z-10 text-lg font-medium leading-snug text-white/95">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <p className="relative z-10 mt-6 text-[13px] font-medium text-white/50">{t.who}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scroll-reveal ── */}
      <section id="about" className="grid-lines border-y border-border px-6 py-32 sm:py-44 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-10 text-[13px] font-medium uppercase tracking-[0.3em] text-green-bright">What is Inboundr?</p>
          <h2 className="text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl lg:text-[3.25rem] lg:leading-[1.15]">
            <RevealLine text="Inboundr automates everything that happens after a customer inquiry — replies, quotes, follow-ups, and conversions." />
          </h2>
          <div className="mt-24 grid gap-16 sm:mt-32 lg:grid-cols-2 lg:gap-24">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-text-dim">Before</p>
              <p className="text-xl leading-snug text-text-muted sm:text-2xl">
                <RevealLine text="Leads sit for hours. Quotes take days. Follow-ups get forgotten. Revenue leaks." />
              </p>
            </div>
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gold">After</p>
              <p className="text-xl font-medium leading-snug sm:text-2xl">
                <RevealLine text="Every lead gets an instant reply, a quote in minutes, and relentless follow-up. Automatically." />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 sm:py-36 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl lg:text-5xl">
            Inbound, handled&nbsp;automatically.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-text-muted">
            Stop wasting time replying, quoting, and chasing.
            Let AI do it — instantly, accurately, 24/7.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <a
              href="mailto:hello@inboundr.ai?subject=Inboundr demo"
              className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90"
            >
              Start free
            </a>
            <a
              href="mailto:hello@inboundr.ai?subject=Contact Sales"
              className="border border-border px-7 py-3.5 text-sm font-medium transition hover:border-text/20 hover:bg-surface"
            >
              Book a demo
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
