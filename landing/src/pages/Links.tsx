import { motion } from "motion/react"
import {
  ScissorsIcon,
  BarChart3Icon,
  QrCodeIcon,
  LockIcon,
  TimerIcon,
  MapPinIcon,
  MailIcon,
  EyeIcon,
  SmartphoneIcon,
  ArchiveIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"

const features = [
  {
    icon: ScissorsIcon,
    title: "Branded short links",
    text: "Turn any long or messy URL into a clean short link. Set a custom back-half or generate one with a click — your link, your way.",
    accent: "bg-green/40",
  },
  {
    icon: BarChart3Icon,
    title: "Engagement analytics",
    text: "See total engagements, a 30-day trend chart, and weekly change at a glance. Know exactly when and how often your links get opened.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: SmartphoneIcon,
    title: "Device & location insight",
    text: "Every event captures browser, OS, device, and approximate city or country — so you know who's engaging and from where.",
    accent: "bg-[#1a6a5c]/40",
  },
  {
    icon: LockIcon,
    title: "Access controls",
    text: "Protect links with a password, set an expiry date, or cap the number of views. Sensitive links stay under your control.",
    accent: "bg-green/40",
  },
  {
    icon: QrCodeIcon,
    title: "QR codes",
    text: "Generate and download a QR code for any link — perfect for print, packaging, and events. Scans are tracked automatically.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: MapPinIcon,
    title: "Precise location tracking",
    text: "Opt in to precise location with a clean consent screen, then view engagements on a map — built for field sales and proof-of-visit.",
    accent: "bg-[#1a6a5c]/40",
  },
]

const steps = [
  {
    num: "01",
    title: "Create a link",
    text: "Paste your destination URL, pick a custom back-half or generate one, and add a title. Set a password, expiry, or view limit if you need to.",
  },
  {
    num: "02",
    title: "Share it your way",
    text: "Copy the short link, email it to a customer straight from Inboundr, or download a QR code for offline use. One link works everywhere.",
  },
  {
    num: "03",
    title: "Track engagement",
    text: "Watch engagements roll in with a live 30-day chart, device and location breakdowns, and a recent-events feed showing every open.",
  },
  {
    num: "04",
    title: "Manage your library",
    text: "Search and filter every link from one dashboard. Archive links when campaigns end — without losing the historical analytics behind them.",
  },
]

const controls = [
  { icon: ScissorsIcon, label: "Custom slug" },
  { icon: LockIcon, label: "Password" },
  { icon: TimerIcon, label: "Expiry date" },
  { icon: EyeIcon, label: "View limits" },
  { icon: MapPinIcon, label: "Location" },
  { icon: QrCodeIcon, label: "QR code" },
  { icon: MailIcon, label: "Email share" },
  { icon: ArchiveIcon, label: "Archive" },
]

export default function Links() {
  return (
    <>
      <title>Links — Inboundr</title>
      {/* ── Hero ── */}
      <section className="noise relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(62,207,142,0.1),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3">
              <span className="inline-block bg-gold px-3 py-1 label-sm text-base">
                Feature
              </span>
              <span className="font-mono text-[13px] text-text-dim">February 2026</span>
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Introducing{" "}
              <span className="font-display italic text-gold">Links</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              Tracked short links, built right into Inboundr. Shorten any URL,
              control who can open it, and measure every engagement — device,
              location, and all.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Overview ── */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="label-sm mb-4 text-green-bright">
              Why we built this
            </p>
          </FadeIn>
          <FadeIn delay={0.06}>
            <p className="text-xl leading-relaxed text-text-muted sm:text-2xl">
              Your team sends links all day — quotes, catalogs, documents, sign-up
              pages. The moment a customer clicks one, you lose all visibility.
              Did they open it? When? On what device? A generic link shortener
              lives in yet another tool, disconnected from your pipeline.
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="mt-8 text-xl leading-relaxed sm:text-2xl">
              Links lives inside Inboundr. Create a controlled short URL, share it,
              and watch engagement in real time — with passwords, expiry, view
              limits, and location built in. No third-party shortener. No blind
              spots.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Controls strip ── */}
      <section className="border-b border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-center text-text-dim">
              Built-in controls
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {controls.map((c, i) => (
              <FadeIn key={c.label} delay={i * 0.04}>
                <div className="flex items-center gap-3 border border-border bg-surface/50 px-4 py-3 text-sm text-text-muted transition-colors hover:border-text/10 hover:text-text">
                  <c.icon className="size-4 shrink-0 text-green-bright" />
                  {c.label}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-4 text-text-muted">
              What's included
            </p>
            <h2 className="max-w-xl text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl">
              Everything you need to share, control, and measure links.
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.06}>
                <div className="group flex h-full flex-col border border-border p-7 card-hover sm:p-8">
                  <div className={`mb-4 flex size-10 items-center justify-center ${f.accent}`}>
                    <f.icon className="size-5 text-text" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {f.text}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">
              How it works
            </p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.06}>
              <div className="group flex gap-6 border-b border-border py-8 sm:gap-10">
                <span className="shrink-0 font-mono text-xs text-text-dim">
                  {s.num}
                </span>
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">{s.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-muted">
                    {s.text}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Highlight banner ── */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn>
          <div className="noise relative mx-auto max-w-4xl overflow-hidden bg-green p-10 sm:p-14">
            <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="label-sm text-text-muted">
                  Built for Inboundr
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">
                  Every link, tracked where your customers live.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
                  Links sit alongside your inbox, quotes, and deals — so the URLs
                  you send become signals you can act on. See engagement the
                  moment a customer opens, then follow up while interest is hot.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.a
                  href="https://app.inboundr.co/"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Links
                </motion.a>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <CtaSection
        heading="Start sharing smarter links."
        description="Links is available now for all Inboundr users. Create your first tracked link in seconds."
        actions={[
          { label: "Get started free", href: "https://app.inboundr.co/", external: true, icon: "arrow-right" },
          { label: "Talk to us", href: "/contact", variant: "secondary", icon: "arrow-up-right" },
        ]}
      />
    </>
  )
}
