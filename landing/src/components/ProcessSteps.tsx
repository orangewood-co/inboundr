import { useRef } from "react"
import { Link } from "react-router-dom"
import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { ArrowUpRight } from "lucide-react"

const steps = [
  {
    num: "01",
    title: "A lead arrives",
    description: "AI reads and understands every inbound inquiry, from any channel.",
    to: "/product/ai-crm",
  },
  {
    num: "02",
    title: "It gets an instant reply",
    description: "A personalized response goes out in seconds, not hours.",
    to: "/product/auto-reply",
  },
  {
    num: "03",
    title: "A quote is on its way",
    description: "Accurate quotes generated from your catalog and pricing rules.",
    to: "/product/quotes",
  },
  {
    num: "04",
    title: "No thread goes cold",
    description: "Relentless follow-ups until the lead responds or converts.",
    to: "/product/follow-ups",
  },
  {
    num: "05",
    title: "Warm leads get a call",
    description: "AI voice picks up the phone when a lead is ready to talk.",
    to: "/product/calls",
  },
  {
    num: "06",
    title: "The conversation never stops",
    description: "Live AI chat on your website and WhatsApp, around the clock.",
    to: "/features",
  },
]

function Step({
  step,
  isLast,
}: {
  step: (typeof steps)[number]
  isLast: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  // Activates when the step's node crosses the same point the rail fill is
  // animated towards (~55% down the viewport).
  const inView = useInView(ref, { once: true, margin: "0px 0px -45% 0px" })
  const lit = reduceMotion || inView

  return (
    <div ref={ref} className="relative pl-10 sm:pl-14">
      {/* Node on the rail */}
      <span
        className="absolute left-[5px] top-[calc(1.25rem+0.5em)] z-10 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,box-shadow] duration-500"
        style={{
          backgroundColor: lit ? "var(--color-green-bright)" : "rgba(237, 242, 236, 0.15)",
          boxShadow: lit ? "0 0 12px rgba(62, 207, 142, 0.5)" : "none",
        }}
        aria-hidden
      />
      <Link
        to={step.to}
        className={`group flex items-baseline gap-5 py-5 sm:gap-8 ${isLast ? "" : "border-b border-border"} transition-colors duration-200 hover:border-text/15`}
      >
        <span
          className={`shrink-0 font-mono text-xs transition-colors duration-500 group-hover:text-gold ${lit ? "text-gold" : "text-text-dim"}`}
        >
          {step.num}
        </span>
        <span className="min-w-0 transition-transform duration-200 ease-out group-hover:translate-x-1">
          <span
            className={`block text-xl font-medium tracking-[-0.01em] transition-colors duration-500 group-hover:text-text sm:text-2xl lg:text-3xl ${lit ? "text-text" : "text-text-dim"}`}
          >
            {step.title}
          </span>
          <span
            className={`mt-1.5 block max-w-xl text-sm leading-relaxed transition-[color,opacity] duration-500 sm:text-[15px] ${lit ? "text-text-muted opacity-100" : "text-text-dim opacity-60"}`}
          >
            {step.description}
          </span>
        </span>
        <ArrowUpRight className="ml-auto size-5 shrink-0 self-center -translate-x-1.5 text-text-dim opacity-0 transition-[opacity,translate,color] duration-200 ease-out group-hover:translate-x-0 group-hover:text-text group-hover:opacity-100" />
      </Link>
    </div>
  )
}

export function ProcessSteps() {
  const railRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 0.7", "end 0.55"],
  })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const scaleY = useTransform(reduceMotion ? scrollYProgress : fill, (v) => (reduceMotion ? 1 : v))

  return (
    <div ref={railRef} className="relative">
      {/* Rail track */}
      <span
        className="absolute bottom-5 left-[5px] top-5 w-px -translate-x-1/2 bg-border"
        aria-hidden
      />
      {/* Rail fill */}
      <motion.span
        className="absolute bottom-5 left-[5px] top-5 w-px -translate-x-1/2 origin-top"
        style={{
          scaleY,
          background:
            "linear-gradient(to bottom, var(--color-green-bright), var(--color-gold))",
        }}
        aria-hidden
      />
      <div className="space-y-0">
        {steps.map((s, i) => (
          <Step key={s.num} step={s} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  )
}
