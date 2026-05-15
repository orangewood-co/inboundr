import { Link } from "react-router-dom"
import { motion } from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarIcon,
  CheckSquareIcon,
  CodeXmlIcon,
  FileUpIcon,
  GripVerticalIcon,
  HashIcon,
  LayoutListIcon,
  MailIcon,
  PaletteIcon,
  PhoneIcon,
  SparklesIcon,
  TypeIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"

const features = [
  {
    icon: GripVerticalIcon,
    title: "Drag-and-drop builder",
    text: "Visually compose forms by dragging fields into place. Reorder, duplicate, or remove with a click — no code required.",
    accent: "bg-green/40",
  },
  {
    icon: LayoutListIcon,
    title: "10+ field types",
    text: "Text, email, phone, number, textarea, date, file upload, checkbox, dropdown, and more — every input you need, ready to go.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: PaletteIcon,
    title: "Custom themes & branding",
    text: "Set accent colors, add your logo, and customize every detail so forms feel native to your brand.",
    accent: "bg-[#1a6a5c]/40",
  },
  {
    icon: CodeXmlIcon,
    title: "Embed anywhere",
    text: "Share via direct link, drop in an iframe, or paste a script tag. Your form works wherever your audience is.",
    accent: "bg-green/40",
  },
  {
    icon: HashIcon,
    title: "Submissions & analytics",
    text: "Track every response in real time. Sort, filter, review details, and export to CSV — all from one dashboard.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: SparklesIcon,
    title: "AI-powered fields",
    text: "Let AI suggest and generate fields based on your form's purpose. Build smarter forms in seconds.",
    accent: "bg-[#1a6a5c]/40",
  },
]

const steps = [
  {
    num: "01",
    title: "Create your form",
    text: "Open Form Studio and start from scratch. Add a welcome screen, drop in your questions, and arrange them in the perfect order.",
  },
  {
    num: "02",
    title: "Make it yours",
    text: "Pick an accent color, upload your logo, and write copy that sounds like you. The form should feel like an extension of your brand, not a third-party tool.",
  },
  {
    num: "03",
    title: "Share it everywhere",
    text: "Grab the public link, copy the embed snippet, or use the iframe — whatever fits your workflow. One click to publish, instant to go live.",
  },
  {
    num: "04",
    title: "Collect and act",
    text: "Submissions stream in real time. Review responses, create customers directly from entries, export data, and let Inboundr's AI handle follow-up.",
  },
]

const fieldTypes = [
  { icon: TypeIcon, label: "Short text" },
  { icon: MailIcon, label: "Email" },
  { icon: PhoneIcon, label: "Phone" },
  { icon: HashIcon, label: "Number" },
  { icon: CalendarIcon, label: "Date" },
  { icon: FileUpIcon, label: "File upload" },
  { icon: CheckSquareIcon, label: "Checkbox" },
  { icon: LayoutListIcon, label: "Dropdown" },
]

export default function FormStudio() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="noise grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(62,207,142,0.1),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3">
              <span className="inline-block rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-base">
                New feature
              </span>
              <span className="font-mono text-[13px] text-text-dim">May 2026</span>
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Introducing{" "}
              <span className="font-display italic text-gold">Form Studio</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              A full-featured form builder, built right into Inboundr. Create
              beautiful, branded forms — collect responses, track submissions, and
              let AI handle the rest.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Overview ── */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-green-bright">
              Why we built this
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <p className="text-xl leading-relaxed text-text-muted sm:text-2xl">
              Most form tools force you out of your workflow. You build a form in
              one app, embed it in another, then manually pipe submissions into
              your CRM. That's three tools, three logins, and a dozen things that
              can break.
            </p>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-8 text-xl leading-relaxed sm:text-2xl">
              Form Studio lives inside Inboundr. Create a form, publish it, collect
              responses, and turn them into customers — all without leaving the
              platform. No integrations. No glue code. Just forms that work.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Field types strip ── */}
      <section className="border-b border-border px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="mb-10 text-center text-[13px] font-medium uppercase tracking-[0.3em] text-text-dim">
              Supported field types
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fieldTypes.map((ft, i) => (
              <FadeIn key={ft.label} delay={i * 0.04}>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3 text-sm text-text-muted transition-colors hover:border-text/10 hover:text-text">
                  <ft.icon className="size-4 shrink-0 text-green-bright" />
                  {ft.label}
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
            <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">
              What's included
            </p>
            <h2 className="max-w-xl text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl">
              Everything you need to build, share, and manage forms.
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.06}>
                <div className="group flex h-full flex-col border border-border p-7 transition-colors hover:border-text/10 sm:p-8">
                  <div className={`mb-5 flex size-10 items-center justify-center rounded-lg ${f.accent}`}>
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
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">
              How it works
            </p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.08}>
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
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-muted">
                  Built for Inboundr
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">
                  Forms that feed your pipeline — automatically.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
                  Every submission is a potential customer. Form Studio connects
                  directly to Inboundr's AI engine — auto-replies, quote
                  generation, and follow-ups kick in the moment someone hits
                  submit.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.a
                  href="https://app.inboundr.co/"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Form Studio
                </motion.a>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border px-6 py-24 sm:py-36 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl lg:text-5xl">
            Start building forms today.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-text-muted">
            Form Studio is available now for all Inboundr users. Create your
            first form in under a minute.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="https://app.inboundr.co/"
              className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:bg-text/90"
            >
              Get started free <ArrowRight className="mb-px ml-1 inline size-3.5" />
            </a>
            <Link
              to="/contact"
              className="border border-border px-7 py-3.5 text-sm font-medium transition hover:border-text/20 hover:bg-surface"
            >
              Talk to us <ArrowUpRight className="mb-px ml-1 inline size-3.5" />
            </Link>
          </div>
        </FadeIn>
      </section>
    </>
  )
}
