import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
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
    name: "Manan Gupta",
    role: "VP Sales - RoboViewer",
    avatar: "/testimonials/manan.webp",
    bg: "#1a5c3a",
  },
  {
    quote: "We stopped losing leads overnight. Inboundr handles the entire flow — reply, quote, follow-up.",
    name: "Rohit Kumar",
    role: "OPS - RoboGPT",
    avatar: "/testimonials/rohit.webp",
    bg: "#8a6d1b",
  },
  {
    quote: "Like having a sales team that works 24/7. Instant replies, accurate quotes, persistent follow-ups.",
    name: "Debdatta Singha",
    role: "OPS - VegaEducation",
    avatar: "/testimonials/debdatta.webp",
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

function Em({ children }: { children: React.ReactNode }) {
  return <em className="font-medium not-italic text-text">{children}</em>
}

// Sized so the longest line ("modern businesses.") stays on one line in the copy column.
const heroLineClass =
  "block text-[clamp(2rem,3.75vw,3.375rem)] font-light leading-[1.02] tracking-[-0.04em] text-text"

export default function Home() {
  const reduceMotion = useReducedMotion()
  return (
    <>
      <title>Inboundr - Turn inbound into revenue</title>
      {/* ── Hero ── */}
      {/* The width cap keeps the product shot bleeding off the bottom edge on tall windows. */}
      <section className="noise relative isolate overflow-hidden bg-base bg-[radial-gradient(45%_40%_at_72%_0%,rgba(47,93,80,0.22),transparent_70%)] lg:min-h-[min(88svh,60vw)]">
        {/* Copy */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="pt-16 sm:pt-20 lg:max-w-[44%] lg:pb-24 lg:pt-28 xl:pt-32">
            <h1>
              <HeroLine className={heroLineClass} delay={0.15}>
                The intelligent
              </HeroLine>
              <HeroLine className={heroLineClass} delay={0.25}>
                workspace for
              </HeroLine>
              <HeroLine className={heroLineClass} delay={0.35}>
                modern businesses.
              </HeroLine>
            </h1>

            <motion.p
              className="mt-7 max-w-md text-pretty text-[17px] leading-relaxed text-text-muted"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Inboundr brings your workflows, tools, and AI agents together to automate work, streamline operations, and scale faster.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55 }}
            >
              <motion.a
                href="https://calendly.com/tushgaurav/15min"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 bg-text px-6 py-3.5 text-sm font-semibold text-base transition-shadow duration-200 hover:shadow-[0_0_30px_rgba(62,207,142,0.25)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Book a Demo
                <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </motion.a>
              <motion.a
                href="https://app.inboundr.co/register"
                className="inline-flex items-center justify-center border border-border bg-base/40 px-6 py-3.5 text-sm font-medium text-text backdrop-blur-sm transition-[border-color,background-color] duration-200 hover:border-text/20 hover:bg-surface"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Join Waitlist
              </motion.a>
            </motion.div>
          </div>
        </div>

        {/* Product shot — anchored bottom-right, bleeding off the right and bottom edges */}
        <motion.div
          className="relative z-10 -mr-6 ml-6 mt-14 sm:ml-8 lg:absolute lg:left-[48%] lg:top-[32%] lg:m-0 lg:w-[62vw]"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="h-[320px] overflow-hidden rounded-xl shadow-[0_0_60px_rgba(62,207,142,0.16),0_0_160px_rgba(62,207,142,0.1)] sm:h-[460px] lg:h-auto">
            <div className="w-[135%] max-w-none sm:w-[118%] lg:w-full">
              <img
                src="/screenshot.png"
                alt="Inboundr RFQ workspace showing an inbound request, matched products, and a quote in progress"
                width={1878}
                height={1508}
                fetchPriority="high"
                className="block w-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Fade the product shot into the page below */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-[linear-gradient(to_top,var(--color-base)_0%,rgba(6,9,6,0.85)_35%,transparent_100%)] sm:h-56"
        />
      </section>

      {/* ── Feature strip ── */}
      <section id="features" className="border-b border-border">
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
              <FadeIn key={i} delay={i * 0.1} className="flex">
                <div className="noise relative flex flex-1 flex-col overflow-hidden border border-border p-7 card-hover sm:p-8" style={{ backgroundColor: t.bg }}>
                  <blockquote className="relative z-10 flex-1 text-lg font-medium leading-snug text-white/95">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="relative z-10 mt-6 flex items-center gap-3">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      width={192}
                      height={192}
                      loading="lazy"
                      decoding="async"
                      className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90">{t.name}</p>
                      <p className="label-sm mt-1 text-white/50">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scroll-reveal ── */}
      <section id="about" className="border-y border-border px-6 py-24 sm:py-36 lg:px-8">
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
