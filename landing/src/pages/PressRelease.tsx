import { useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"
import { getReleaseBySlug } from "@/data/press"

const PRESS_EMAIL = "press@inboundr.co"

export default function PressRelease() {
  const { slug } = useParams<{ slug: string }>()
  const release = getReleaseBySlug(slug)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  if (!release) {
    return (
      <>
        <title>Not found — Inboundr</title>
        <section className="px-6 py-32 text-center sm:py-44 lg:px-8">
          <p className="label text-text-muted">404</p>
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Press release not found</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-text-muted">
            This announcement may have moved or never existed.
          </p>
          <Link
            to="/press"
            className="mt-10 inline-block border border-border px-7 py-3.5 text-sm font-medium transition-[border-color,background-color] duration-200 hover:border-text/20 hover:bg-surface"
          >
            Back to Press Room
          </Link>
        </section>
      </>
    )
  }

  const [lead, ...restBody] = release.body

  return (
    <>
      <title>{`${release.title} — Inboundr`}</title>

      <article>
        {/* Header band */}
        <header className="noise relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]" />
          <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-24 sm:pb-20 sm:pt-32 lg:px-8">
            <FadeIn>
              <Link
                to="/press"
                className="group inline-flex items-center gap-2 label-sm text-text-dim transition-colors hover:text-text"
              >
                <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                Press Room
              </Link>
              <div className="mt-8 mb-6 flex flex-wrap items-center gap-3">
                <span
                  className="noise relative overflow-hidden px-2.5 py-0.5 label-sm"
                  style={{ backgroundColor: release.bg }}
                >
                  <span className="relative z-10">{release.tag}</span>
                </span>
                <span className="font-mono text-[11px] text-text-dim">{release.date}</span>
                <span className="font-mono text-[11px] text-text-dim">&middot; {release.readTime}</span>
              </div>
              <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
                {release.title}
              </h1>
            </FadeIn>
          </div>
        </header>

        {/* Body */}
        <div className="px-6 py-16 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <FadeIn>
              <p className="text-lg leading-relaxed text-text sm:text-xl">{lead}</p>
            </FadeIn>

            {release.pullQuote && (
              <FadeIn delay={0.1}>
                <figure className="my-12 border-l-2 border-gold pl-6 sm:my-14 sm:pl-8">
                  <blockquote className="font-display text-2xl italic leading-snug text-text sm:text-3xl">
                    &ldquo;{release.pullQuote.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 label-sm text-text-dim">{release.pullQuote.attribution}</figcaption>
                </figure>
              </FadeIn>
            )}

            <div className="mt-8 space-y-6 text-base leading-relaxed text-text-muted">
              {restBody.map((paragraph, i) => (
                <FadeIn key={i} delay={i * 0.05}>
                  <p>{paragraph}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </article>

      <CtaSection
        heading="More from Inboundr"
        description="Browse the rest of our announcements, or get in touch with the press team directly."
        actions={[
          { label: "All press releases", href: "/press", icon: "arrow-right" },
          { label: "Email press team", href: `mailto:${PRESS_EMAIL}`, external: true, variant: "secondary" },
        ]}
      />
    </>
  )
}
