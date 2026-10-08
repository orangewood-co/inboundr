export type FeatureSlug = "assets" | "support" | "invoices" | "forms" | "employees" | "drive" | "links"

export interface Feature {
  slug: FeatureSlug
  title: string
  summary: string
  description: string
  date: string
  tag: "New" | "Feature"
  bg: string
}

// Most recent first. `summary` is the one-liner used on homepage cards.
export const features: Feature[] = [
  {
    slug: "assets",
    title: "Assets",
    summary: "Know who holds every laptop, and what it's worth today.",
    description: "A full asset register with employee custody, locations, automatic depreciation schedules, warranty and repair tracking, and disposal with gain or loss — built right into Inboundr.",
    date: "July 2026",
    tag: "New",
    bg: "#5c3a1a",
  },
  {
    slug: "support",
    title: "Support",
    summary: "Website chat that lands in a shared, realtime inbox.",
    description: "Live chat for your website backed by a realtime team inbox — with visitor context, file and voice messages, branding, and post-chat feedback, built right into Inboundr.",
    date: "June 2026",
    tag: "Feature",
    bg: "#1a6a5c",
  },
  {
    slug: "invoices",
    title: "Invoices",
    summary: "GST invoices in rupees, sent from Gmail and tracked to paid.",
    description: "GST-ready invoicing in INR with product-backed line items, Gmail sending, payment tracking, and a receivables dashboard — built right into Inboundr.",
    date: "June 2026",
    tag: "Feature",
    bg: "#1a5c3a",
  },
  {
    slug: "forms",
    title: "Form Studio",
    summary: "Branded forms that send every response straight into Inboundr.",
    description: "A full-featured form builder with drag-and-drop, custom themes, embeds, and submission tracking — built right into Inboundr.",
    date: "May 2026",
    tag: "Feature",
    bg: "#8a6d1b",
  },
  {
    slug: "employees",
    title: "Employees",
    summary: "Onboard your team and choose which modules each person sees.",
    description: "A team directory with guided onboarding, teams, granular module access control, login linking, and branded HR documents.",
    date: "April 2026",
    tag: "Feature",
    bg: "#1a6a5c",
  },
  {
    slug: "drive",
    title: "Drive",
    summary: "Files for your team, and view-only links for your customers.",
    description: "An in-app file workspace to upload, preview, and organize files and folders, then share them with your team or customers.",
    date: "March 2026",
    tag: "Feature",
    bg: "#2d5a4a",
  },
  {
    slug: "links",
    title: "Links",
    summary: "Short links that show who opened them, from where, and when.",
    description: "Tracked short links with engagement analytics, device and location insight, passwords, expiry, view limits, and QR codes.",
    date: "February 2026",
    tag: "Feature",
    bg: "#7a5a1b",
  },
]
