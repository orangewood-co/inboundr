import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { AuroraBackground } from "@/components/AuroraBackground"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"
import { Faq } from "@/components/Faq"
import { ProcessSteps } from "@/components/ProcessSteps"

const faqs = [
  {
    q: "How does Inboundr connect to my inbox, website, and WhatsApp?",
    a: "Inboundr plugs in through standard integrations — connect your email inbox, drop a snippet on your website, and link your WhatsApp Business number. No engineering work required; most teams are connected in a few clicks.",
  },
  {
    q: "How accurate are the AI-generated quotes?",
    a: "Quotes are generated from your own catalog, pricing rules, and past deals, so they come back ready to send. You can keep a human in the loop to approve before anything goes out until you're confident.",
  },
  {
    q: "Is my data secure?",
    a: "Your data is encrypted in transit and at rest, and it's never used to train shared models. Access is scoped to your workspace, and you stay in full control of what Inboundr can read and send.",
  },
  {
    q: "How long does setup take?",
    a: "Most teams are live the same day. Connect your channels, point Inboundr at your catalog, and it starts reading and replying to inbound right away — no long onboarding or migration.",
  },
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

function HeroLine({
  children,
  className,
  delay,
}: {
  children: React.ReactNode
  className: string
  delay: number
}) {
  const reduceMotion = useReducedMotion()
  return (
    <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
      <motion.span
        className={className}
        initial={reduceMotion ? { opacity: 0 } : { y: "110%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  )
}

export default function Home() {
  const reduceMotion = useReducedMotion()
  return (
    <>
      <title>Inboundr — Turn inbound into revenue</title>
      {/* ── Hero ── */}
      <AuroraBackground className="noise overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-32 pt-36 text-center sm:pb-44 sm:pt-48 lg:px-8">
          <motion.p
            className="label mb-8 text-green-bright"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            AI-native sales infrastructure
          </motion.p>
          <h1>
            <HeroLine
              className="block text-[clamp(3rem,8vw,6rem)] font-light leading-[0.95] tracking-[-0.04em] text-text"
              delay={0.15}
            >
              Turn inbound
            </HeroLine>
            <HeroLine
              className="block font-display text-[clamp(3.5rem,10vw,8rem)] italic leading-[0.9] tracking-[-0.02em] text-gold"
              delay={0.27}
            >
              into revenue.
            </HeroLine>
          </h1>
          <motion.p
            className="mx-auto mt-8 max-w-md text-pretty text-[17px] leading-relaxed text-text-muted"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            AI that replies, quotes, follows up, and closes — automatically.
          </motion.p>
          <motion.div
            className="mt-10 flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
          >
            <motion.a
              href="https://calendly.com/tushgaurav/15min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-text px-7 py-3.5 text-sm font-semibold text-base transition-shadow duration-200 hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Book a Demo
            </motion.a>
          </motion.div>
        </div>
      </AuroraBackground>

      {/* ── Feature strip ── */}
      <section id="features" className="border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-8">
          <FadeIn>
            <p className="label mb-4 text-text-muted">
              What it does
            </p>
            <h2 className="mb-12 text-balance text-2xl font-bold tracking-[-0.02em] text-text sm:text-3xl">
              From first message to closed deal.
            </h2>
          </FadeIn>
          <ProcessSteps />
        </div>
      </section>

      {/* ── Problem / Solution ── */}
      <section className="border-b border-border px-6 py-24 sm:py-36 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <FadeIn>
              <p className="label-sm mb-4 text-text-dim">The problem</p>
              <h2 className="text-balance text-2xl font-bold leading-snug text-text-muted sm:text-3xl lg:text-4xl">
                Your team wastes time replying, quoting, and chasing leads.
              </h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="label-sm mb-4 text-gold">The solution</p>
              <h2 className="text-balance text-2xl font-bold leading-snug sm:text-3xl lg:text-4xl">
                We handle it instantly with AI.
              </h2>
              <p className="mt-6 text-pretty text-base leading-relaxed text-text-muted">
                Inboundr plugs into your inbox, website, and WhatsApp.
                It reads every inquiry, drafts quotes from your catalog,
                follows up on open threads, and even calls warm leads.
                Your reps focus on closing.
              </p>
              <a
                href="https://app.inboundr.co/"
                className="link-underline mt-8 inline-flex items-center gap-2 text-sm font-medium text-green-bright transition-colors duration-200 hover:text-text"
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
            <p className="label mb-10 text-text-muted">What teams say</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="noise relative overflow-hidden border border-border p-7 card-hover sm:p-8" style={{ backgroundColor: t.bg }}>
                  <blockquote className="relative z-10 text-lg font-medium leading-snug text-white/95">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <p className="relative z-10 mt-6 label text-white/50">{t.who}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scroll-reveal ── */}
      <section id="about" className="grid-lines border-y border-border px-6 py-24 sm:py-36 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="label mb-10 text-green-bright">What is Inboundr?</p>
          <h2 className="text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl lg:text-[3.25rem] lg:leading-[1.15]">
            <RevealLine text="Inboundr automates everything that happens after a customer inquiry — replies, quotes, follow-ups, and conversions." />
          </h2>
          <div className="mt-24 grid gap-16 sm:mt-32 lg:grid-cols-2 lg:gap-24">
            <div>
              <p className="label-sm mb-4 text-text-dim">Before</p>
              <p className="text-xl leading-snug text-text-muted sm:text-2xl">
                <RevealLine text="Leads sit for hours. Quotes take days. Follow-ups get forgotten. Revenue leaks." />
              </p>
            </div>
            <div>
              <p className="label-sm mb-4 text-gold">After</p>
              <p className="text-xl font-medium leading-snug sm:text-2xl">
                <RevealLine text="Every lead gets an instant reply, a quote in minutes, and relentless follow-up. Automatically." />
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-border px-6 py-24 sm:py-36 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="label mb-4 text-text-muted">Questions</p>
            <h2 className="mb-12 text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Frequently asked.
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Faq items={faqs} />
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ── */}
      <CtaSection
        heading="Inbound, handled&nbsp;automatically."
        description="Stop wasting time replying, quoting, and chasing. Let AI do it — instantly, accurately, 24/7."
        border={false}
        actions={[
          { label: "Start free", href: "mailto:hello@inboundr.ai?subject=Inboundr demo", external: true },
          { label: "Book a demo", href: "mailto:hello@inboundr.ai?subject=Contact Sales", variant: "secondary", external: true },
        ]}
      />
    </>
  )
}
