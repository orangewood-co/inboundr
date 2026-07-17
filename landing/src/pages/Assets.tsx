import { motion } from "motion/react"
import {
  ArchiveIcon,
  BanknoteIcon,
  CircleCheckIcon,
  FilePenIcon,
  FileSpreadsheetIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TrendingDownIcon,
  Trash2Icon,
  UserCheckIcon,
  WrenchIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"

const features = [
  {
    icon: ArchiveIcon,
    title: "Asset register",
    text: "Every asset gets an auto-generated code like AST-0001, a serial number, a category, photos, and attachments — one searchable register for everything you own.",
    accent: "bg-green/40",
  },
  {
    icon: UserCheckIcon,
    title: "Custody & locations",
    text: "Assign assets to employees and locations, move them as things change, and see the full activity timeline. Assignees get an email the moment an asset lands on them.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: TrendingDownIcon,
    title: "Automatic depreciation",
    text: "Straight line or written down value, with schedules aligned to the Indian fiscal year. Book value is computed for any date — no spreadsheet formulas.",
    accent: "bg-[#1a6a5c]/40",
  },
  {
    icon: ScaleIcon,
    title: "Adjustments & disposal",
    text: "Revalue an asset mid-life after damage or revaluation, and the schedule recalculates. Sell or scrap with gain or loss computed against book value automatically.",
    accent: "bg-green/40",
  },
  {
    icon: ShieldCheckIcon,
    title: "Warranty, AMC & repairs",
    text: "Track warranty and AMC expiry dates, see what's expiring soon, and keep a repair log with dates and costs against every asset.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: FileSpreadsheetIcon,
    title: "Reports & import",
    text: "Export a depreciation register — cost, accumulated depreciation, book value as of any date — to CSV, and onboard an existing register with bulk import.",
    accent: "bg-[#1a6a5c]/40",
  },
]

const steps = [
  {
    num: "01",
    title: "Register your assets",
    text: "Create assets one by one — with copies for identical items like chairs — or import your existing register from a spreadsheet with column matching.",
  },
  {
    num: "02",
    title: "Activate & assign",
    text: "Activate an asset to generate its depreciation schedule, then assign it to an employee and a location. The custodian is notified by email automatically.",
  },
  {
    num: "03",
    title: "Track through its life",
    text: "Log repairs, move assets between locations, adjust value after damage or revaluation, and watch warranties — every change lands on the activity timeline.",
  },
  {
    num: "04",
    title: "Report & dispose",
    text: "Download the depreciation register for your accountant, and when an asset's time is up, sell or scrap it with gain or loss computed for you.",
  },
]

const lifecycle = [
  { icon: FilePenIcon, label: "Draft" },
  { icon: CircleCheckIcon, label: "Active" },
  { icon: WrenchIcon, label: "In repair" },
  { icon: BanknoteIcon, label: "Sold" },
  { icon: Trash2Icon, label: "Scrapped" },
]

export default function Assets() {
  return (
    <>
      <title>Assets — Inboundr</title>
      {/* ── Hero ── */}
      <section className="noise relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(62,207,142,0.1),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3">
              <span className="inline-block bg-gold px-3 py-1 label-sm text-base">
                New feature
              </span>
              <span className="font-mono text-[13px] text-text-dim">July 2026</span>
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Introducing{" "}
              <span className="font-display italic text-gold">Assets</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              Track everything your company owns, from purchase to disposal.
              A full asset register with custody, automatic depreciation, and
              warranty tracking — right next to your team and billing.
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
              Most asset registers rot in a spreadsheet. Nobody knows who has
              which laptop, what the machine on the shop floor is worth today,
              or that a warranty lapsed last month — until an audit or a loss
              forces the question.
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="mt-8 text-xl leading-relaxed sm:text-2xl">
              Assets lives inside Inboundr, beside your employees and invoices.
              Assign equipment to the people who hold it, let depreciation
              compute itself, and answer "what do we own and what is it worth?"
              in one click.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Lifecycle strip ── */}
      <section className="border-b border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-center text-text-dim">
              The whole lifecycle, tracked
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {lifecycle.map((stage, i) => (
              <FadeIn key={stage.label} delay={i * 0.04}>
                <div className="flex items-center gap-3 border border-border bg-surface/50 px-4 py-3 text-sm text-text-muted transition-colors hover:border-text/10 hover:text-text">
                  <stage.icon className="size-4 shrink-0 text-green-bright" />
                  {stage.label}
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
              Everything you need to know what you own.
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
                  Every asset, accounted for.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
                  Assets draws on the employees already in Inboundr, so custody
                  is a click, not a chase. Depreciation, warranties, repairs,
                  and disposals stay in the same place you run the rest of the
                  business.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.a
                  href="https://app.inboundr.co/"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Assets
                </motion.a>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <CtaSection
        heading="Know what you own."
        description="Assets is available now in Inboundr. Register your first asset or import your existing register in minutes."
        actions={[
          { label: "Get started free", href: "https://app.inboundr.co/", external: true, icon: "arrow-right" },
          { label: "Talk to us", href: "/contact", variant: "secondary", icon: "arrow-up-right" },
        ]}
      />
    </>
  )
}
