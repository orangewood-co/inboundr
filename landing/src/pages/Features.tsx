import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

const features = [
  {
    title: "Assets",
    description: "A full asset register with employee custody, locations, automatic depreciation schedules, warranty and repair tracking, and disposal with gain or loss — built right into Inboundr.",
    date: "July 2026",
    tag: "New",
    to: "/features/assets",
    bg: "#5c3a1a",
  },
  {
    title: "Support",
    description: "Live chat for your website backed by a realtime team inbox — with visitor context, file and voice messages, branding, and post-chat feedback, built right into Inboundr.",
    date: "June 2026",
    tag: "Feature",
    to: "/features/support",
    bg: "#1a6a5c",
  },
  {
    title: "Invoices",
    description: "GST-ready invoicing in INR with product-backed line items, Gmail sending, payment tracking, and a receivables dashboard — built right into Inboundr.",
    date: "June 2026",
    tag: "Feature",
    to: "/features/invoices",
    bg: "#1a5c3a",
  },
  {
    title: "Form Studio",
    description: "A full-featured form builder with drag-and-drop, custom themes, embeds, and submission tracking — built right into Inboundr.",
    date: "May 2026",
    tag: "Feature",
    to: "/features/forms",
    bg: "#8a6d1b",
  },
  {
    title: "Employees",
    description: "A team directory with guided onboarding, teams, granular module access control, login linking, and branded HR documents.",
    date: "April 2026",
    tag: "Feature",
    to: "/features/employees",
    bg: "#1a6a5c",
  },
  {
    title: "Drive",
    description: "An in-app file workspace to upload, preview, and organize files and folders, then share them with your team or customers.",
    date: "March 2026",
    tag: "Feature",
    to: "/features/drive",
    bg: "#2d5a4a",
  },
  {
    title: "Links",
    description: "Tracked short links with engagement analytics, device and location insight, passwords, expiry, view limits, and QR codes.",
    date: "February 2026",
    tag: "Feature",
    to: "/features/links",
    bg: "#7a5a1b",
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
