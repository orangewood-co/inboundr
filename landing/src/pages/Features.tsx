import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { features } from "@/data/features"

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
              <Link to={`/features/${feature.slug}`} className="group block h-full">
                <article className="flex h-full flex-col border border-border bg-surface p-7 sm:p-8">
                  <div className="mb-5 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-[-0.01em]">{feature.title}</h2>
                    <span className="shrink-0 font-mono text-[11px] text-text-dim">
                      {feature.tag === "New" && <span className="mr-2 text-green-bright">New</span>}
                      {feature.date}
                    </span>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-text-muted">
                    {feature.description}
                  </p>
                  <div className="mt-6 flex items-center gap-1.5 text-[13px] text-text-dim transition-colors duration-200 group-hover:text-text">
                    Read more
                    <ArrowRight className="size-3.5" />
                  </div>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  )
}
