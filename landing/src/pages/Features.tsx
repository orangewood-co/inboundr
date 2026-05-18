import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

const features = [
  {
    title: "Form Studio",
    description: "A full-featured form builder with drag-and-drop, custom themes, embeds, and submission tracking — built right into Inboundr.",
    date: "May 2026",
    tag: "New",
    to: "/features/forms",
    bg: "#1a5c3a",
  },
]

export default function Features() {
  return (
    <>
      <title>Features — Inboundr</title>
      <PageHeader
        label="Features"
        title="What's new"
        description="New features and improvements shipping to Inboundr."
      />

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 0.1}>
              <Link to={feature.to} className="group block h-full">
                <article className="flex h-full flex-col border border-border p-7 card-hover sm:p-8">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="noise relative overflow-hidden px-2.5 py-0.5 label-sm"
                      style={{ backgroundColor: feature.bg }}
                    >
                      <span className="relative z-10">{feature.tag}</span>
                    </span>
                    <span className="font-mono text-[11px] text-text-dim">{feature.date}</span>
                  </div>
                  <h2 className="text-xl font-bold leading-snug transition-colors group-hover:text-green-bright sm:text-2xl">
                    {feature.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {feature.description}
                  </p>
                  <p className="mt-6 label text-text-dim transition-colors group-hover:text-text">
                    Read more <ArrowRight className="mb-px ml-1 inline size-3" />
                  </p>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  )
}
