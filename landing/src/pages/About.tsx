import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

function RevealLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.5"],
  })
  const words = text.split(" ")
  return (
    <span ref={ref} className="inline">
      {words.map((w, i) => {
        const start = i / words.length
        const end = (i + 1) / words.length
        return <RevealWord key={`${w}-${i}`} word={w} start={start} end={end} progress={scrollYProgress} />
      })}
    </span>
  )
}

function RevealWord({
  word,
  start,
  end,
  progress,
}: {
  word: string
  start: number
  end: number
  progress: ReturnType<typeof useScroll>["scrollYProgress"]
}) {
  const opacity = useTransform(progress, [start, end], [0.15, 1])
  return (
    <motion.span className="inline-block whitespace-pre" style={{ opacity }}>
      {word}{" "}
    </motion.span>
  )
}

const values = [
  { title: "Speed is respect", text: "When a customer reaches out, they deserve an instant, competent response — not a 48-hour autoresponder." },
  { title: "Automation with taste", text: "AI should feel like your best employee, not a chatbot. Every interaction we automate passes the 'would I reply to this?' test." },
  { title: "Revenue, not vanity metrics", text: "We measure success in deals closed, not emails sent. If it doesn't move the needle, we don't build it." },
  { title: "Radical transparency", text: "You see every AI action, every decision, every override. No black boxes. Your data stays yours." },
]

export default function About() {
  return (
    <>
      <title>About — Inboundr</title>
      <PageHeader
        label="Company"
        title="About Inboundr"
        description="We believe every inbound lead deserves an instant, intelligent response — and that AI can deliver it better than a team of ten."
      />

      <section className="px-6 py-24 sm:py-36 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="label mb-10 text-gold">Our manifesto</p>
          <h2 className="text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl lg:text-[3.25rem] lg:leading-[1.15]">
            <RevealLine text="Sales teams are drowning in busywork. They spend more time copying data, writing emails, and chasing cold threads than actually selling. We built Inboundr to flip that equation — so humans focus on relationships and AI handles everything else." />
          </h2>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">What we believe</p>
          </FadeIn>
          <div className="grid gap-0 sm:grid-cols-2">
            {values.map((v, i) => (
              <FadeIn key={v.title} delay={i * 0.1}>
                <div className="border-b border-border p-8 sm:odd:border-r">
                  <h3 className="text-lg font-semibold">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{v.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">Our story</p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mx-auto max-w-3xl space-y-6 text-base leading-relaxed text-text-muted">
              <p>
                Inboundr was born from a simple observation: companies spend millions generating leads but let most of them die in an inbox. We watched sales teams — good ones — lose deals because they couldn't reply fast enough, couldn't quote accurately enough, or simply forgot to follow up.
              </p>
              <p>
                So we built the AI sales engine we wished existed. One that reads every inquiry the moment it arrives, understands what the customer needs, generates an accurate quote from the product catalog, and follows up relentlessly until the deal closes — or the customer says stop.
              </p>
              <p>
                We're a small, focused team obsessed with one thing: making sure no inbound lead ever goes unanswered.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
