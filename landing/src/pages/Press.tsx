import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "motion/react"
import { ArrowUpRight, Check, Copy, Download } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { CtaSection } from "@/components/CtaSection"
import { boilerplate, boilerplate140, newsItems, pressReleases } from "@/data/press"

const PRESS_EMAIL = "press@inboundr.co"

const stats = [
  { value: "2025", label: "Founded" },
  { value: "1M+", label: "Conversations handled" },
  { value: "<60s", label: "Median first response" },
  { value: "Remote", label: "Teams in India & US" },
]

const palette = [
  { name: "Base", hex: "#060906" },
  { name: "Surface", hex: "#0E1310" },
  { name: "Green", hex: "#2F5D50" },
  { name: "Green Bright", hex: "#3ECF8E" },
  { name: "Gold", hex: "#EFC554" },
  { name: "Text", hex: "#EDF2EC" },
]

const assets = [
  { name: "Logo", desc: "Primary, light", file: "/logo.png", onLight: false },
  { name: "Logo (dark)", desc: "For light backgrounds", file: "/logo-black.png", onLight: true },
  { name: "Mark", desc: "Icon only, light", file: "/mark.png", onLight: false },
  { name: "Mark (dark)", desc: "For light backgrounds", file: "/mark-black.png", onLight: true },
]

const learnMore = [
  { title: "Product", desc: "Explore what Inboundr actually does.", to: "/features" },
  { title: "About", desc: "Our mission, beliefs, and story.", to: "/about" },
  { title: "Careers", desc: "Meet the team building it.", to: "/careers" },
]

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copy(key: string, text: string) {
    void navigator.clipboard?.writeText(text)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200)
  }
  return { copiedKey, copy }
}

function CopyButton({
  copyKey,
  value,
  copiedKey,
  onCopy,
}: {
  copyKey: string
  value: string
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
}) {
  const isCopied = copiedKey === copyKey
  return (
    <motion.button
      type="button"
      onClick={() => onCopy(copyKey, value)}
      whileTap={{ scale: 0.97 }}
      className="inline-flex shrink-0 items-center gap-1.5 border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted transition-colors duration-200 hover:border-text/20 hover:text-text"
    >
      {isCopied ? <Check className="size-3.5 text-green-bright" /> : <Copy className="size-3.5" />}
      {isCopied ? "Copied" : "Copy"}
    </motion.button>
  )
}

export default function Press() {
  const { copiedKey, copy } = useCopy()
  const featured = pressReleases[0]
  const rest = pressReleases.slice(1)

  return (
    <>
      <title>Press — Inboundr</title>
      <PageHeader
        label="Company"
        title="Press Room"
        description="News, announcements, and media resources for Inboundr — the AI sales engine for inbound revenue."
      />

      {/* By the numbers */}
      <section className="border-b border-border px-6 py-14 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.08}>
                <div className="px-2">
                  <p className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{stat.value}</p>
                  <p className="mt-2 label-sm text-text-dim">{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Featured release */}
      <section className="border-b border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-8 text-text-muted">Latest announcement</p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Link to={`/press/${featured.slug}`} className="group block">
              <article className="noise relative overflow-hidden border border-border card-hover">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_0%,rgba(47,93,80,0.18),transparent)]" />
                <div className="relative z-10 grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
                  <div>
                    <p className="font-display text-xl italic text-gold sm:text-2xl">Newest from the newsroom</p>
                    <div className="mt-6 mb-5 flex flex-wrap items-center gap-3">
                      <span
                        className="noise relative overflow-hidden px-2.5 py-0.5 label-sm"
                        style={{ backgroundColor: featured.bg }}
                      >
                        <span className="relative z-10">{featured.tag}</span>
                      </span>
                      <span className="font-mono text-[11px] text-text-dim">{featured.date}</span>
                      <span className="font-mono text-[11px] text-text-dim">&middot; {featured.readTime}</span>
                    </div>
                    <h2 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em] transition-colors group-hover:text-green-bright sm:text-4xl lg:text-[2.75rem]">
                      {featured.title}
                    </h2>
                  </div>
                  <div>
                    <p className="text-base leading-relaxed text-text-muted">{featured.excerpt}</p>
                    <p className="mt-6 label text-text-dim transition-colors group-hover:text-text">
                      Read the announcement &rarr;
                    </p>
                  </div>
                </div>
              </article>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Press releases grid */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">Press releases</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((release, i) => (
              <FadeIn key={release.slug} delay={i * 0.1}>
                <Link to={`/press/${release.slug}`} className="group block h-full">
                  <article className="noise relative flex h-full flex-col overflow-hidden border border-border card-hover">
                    <div className="relative z-10 flex flex-1 flex-col p-7 sm:p-8">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          className="noise relative overflow-hidden px-2.5 py-0.5 label-sm"
                          style={{ backgroundColor: release.bg }}
                        >
                          <span className="relative z-10">{release.tag}</span>
                        </span>
                        <span className="font-mono text-[11px] text-text-dim">{release.date}</span>
                      </div>
                      <h3 className="text-xl font-bold leading-snug transition-colors group-hover:text-green-bright sm:text-2xl">
                        {release.title}
                      </h3>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{release.excerpt}</p>
                      <p className="mt-6 label text-text-dim transition-colors group-hover:text-text">Read more &rarr;</p>
                    </div>
                  </article>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* In the news */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">Inboundr in the news</p>
          </FadeIn>
          {newsItems.map((item, i) => (
            <FadeIn key={item.headline} delay={i * 0.05}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-6 border-b border-border py-6 transition-colors hover:border-text/15"
              >
                <div>
                  <div className="mb-1 flex gap-3 label-sm text-text-dim">
                    <span className="text-green-bright">{item.outlet}</span>
                    <span>&middot;</span>
                    <span>{item.date}</span>
                  </div>
                  <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-green-bright sm:text-xl">
                    {item.headline}
                  </h3>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-text-dim transition-colors group-hover:text-text" />
              </a>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Media kit */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-4 text-text-muted">Media kit</p>
            <p className="mb-12 max-w-xl text-base leading-relaxed text-text-muted">
              Logos, colors, and type for using the Inboundr brand. Please don&apos;t alter the logo or recolor it.
            </p>
          </FadeIn>

          {/* Logos & assets */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {assets.map((asset, i) => (
              <FadeIn key={asset.name} delay={i * 0.08}>
                <div className="flex h-full flex-col overflow-hidden border border-border card-hover">
                  <div
                    className="flex h-32 items-center justify-center border-b border-border p-6"
                    style={asset.onLight ? { backgroundColor: "#ffffff" } : { backgroundColor: "#151c17" }}
                  >
                    <img src={asset.file} alt={`${asset.name} preview`} className="max-h-14 max-w-[75%] object-contain" />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">{asset.name}</p>
                      <p className="label-sm mt-1 text-text-dim">{asset.desc}</p>
                    </div>
                    <motion.a
                      href={asset.file}
                      download
                      whileTap={{ scale: 0.97 }}
                      aria-label={`Download ${asset.name}`}
                      className="inline-flex shrink-0 items-center gap-1.5 border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted transition-colors duration-200 hover:border-text/20 hover:text-text"
                    >
                      <Download className="size-3.5" />
                      PNG
                    </motion.a>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.1}>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 border border-border px-7 py-3.5 text-sm font-medium transition-[border-color,background-color] duration-200 hover:border-text/20 hover:bg-surface"
              >
                <Download className="size-4" />
                Download full press kit (.zip)
              </motion.button>
              <span className="text-[13px] text-text-dim">Logos above are ready to use. Full kit coming soon.</span>
            </div>
          </FadeIn>

          {/* Color palette */}
          <FadeIn>
            <p className="label mb-8 mt-20 text-text-muted">Color palette</p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {palette.map((color, i) => (
              <FadeIn key={color.hex} delay={i * 0.05}>
                <motion.button
                  type="button"
                  onClick={() => copy(color.hex, color.hex)}
                  whileTap={{ scale: 0.98 }}
                  className="group block w-full overflow-hidden border border-border text-left card-hover"
                >
                  <div className="h-20 ring-1 ring-inset ring-white/10" style={{ backgroundColor: color.hex }} />
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{color.name}</p>
                      <p className="font-mono text-[11px] text-text-dim">{color.hex}</p>
                    </div>
                    {copiedKey === color.hex ? (
                      <Check className="size-4 shrink-0 text-green-bright" />
                    ) : (
                      <Copy className="size-4 shrink-0 text-text-dim transition-colors group-hover:text-text" />
                    )}
                  </div>
                </motion.button>
              </FadeIn>
            ))}
          </div>

          {/* Typography */}
          <FadeIn>
            <p className="label mb-8 mt-20 text-text-muted">Typography</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2">
            <FadeIn>
              <div className="flex h-full flex-col border border-border p-8">
                <p className="label-sm text-text-dim">Display</p>
                <p className="mt-6 font-display text-5xl italic text-gold sm:text-6xl">Inboundr</p>
                <p className="mt-auto pt-6 text-sm leading-relaxed text-text-muted">
                  Instrument Serif &mdash; reserved for accents and emphasis.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="flex h-full flex-col border border-border p-8">
                <p className="label-sm text-text-dim">Sans</p>
                <p className="mt-6 text-5xl font-bold tracking-[-0.02em] sm:text-6xl">Inboundr</p>
                <p className="mt-auto pt-6 text-sm leading-relaxed text-text-muted">
                  Sora &mdash; used for everything else. Aa Bb Cc 0123456789
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Boilerplate */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">Boilerplate</p>
          </FadeIn>
          <FadeIn delay={0.05}>
            <div className="border border-border p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="label-sm text-text-dim">Inboundr in 140 characters</p>
                <CopyButton copyKey="b140" value={boilerplate140} copiedKey={copiedKey} onCopy={copy} />
              </div>
              <p className="mt-4 text-base leading-relaxed">{boilerplate140}</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.12}>
            <div className="mt-4 border border-border p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="label-sm text-text-dim">Full boilerplate</p>
                <CopyButton copyKey="bfull" value={boilerplate} copiedKey={copiedKey} onCopy={copy} />
              </div>
              <p className="mt-4 text-base leading-relaxed text-text-muted">{boilerplate}</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Press contact */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
            <FadeIn>
              <p className="label text-text-muted">Press contact</p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="label-sm text-text-dim">Press inquiries</p>
              <a
                href={`mailto:${PRESS_EMAIL}`}
                className="mt-1 block text-2xl font-medium transition hover:text-green-bright sm:text-3xl"
              >
                {PRESS_EMAIL}
              </a>
              <p className="mt-6 max-w-md text-base leading-relaxed text-text-muted">
                For interviews, asset requests, or fact-checking, reach out and we&apos;ll get back to you within one
                business day.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Learn more */}
      <section className="border-t border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">Learn more about Inboundr</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {learnMore.map((item, i) => (
              <FadeIn key={item.to} delay={i * 0.1}>
                <Link to={item.to} className="group block h-full">
                  <div className="flex h-full flex-col border border-border p-7 card-hover">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold transition-colors group-hover:text-green-bright">
                        {item.title}
                      </h3>
                      <ArrowUpRight className="size-5 shrink-0 text-text-dim transition-colors group-hover:text-text" />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.desc}</p>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        heading="Working on a story?"
        description="We're happy to help with interviews, data, and assets. Reach out and we'll respond quickly."
        actions={[
          { label: "Email press team", href: `mailto:${PRESS_EMAIL}`, external: true, icon: "arrow-right" },
          { label: "Contact us", href: "/contact", variant: "secondary" },
        ]}
      />
    </>
  )
}
