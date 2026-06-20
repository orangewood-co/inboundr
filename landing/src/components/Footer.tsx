import { Link } from "react-router-dom"
import Logo from "./Logo"

const footerLinks = [
  {
    heading: "Product",
    items: [
      { label: "AI CRM", to: "/product/ai-crm" },
      { label: "Auto Reply", to: "/product/auto-reply" },
      { label: "Quotes", to: "/product/quotes" },
      { label: "Follow-ups", to: "/product/follow-ups" },
      { label: "Calls", to: "/product/calls" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", to: "/about" },
      { label: "Blog", to: "/blog" },
      { label: "Press", to: "/press" },
      { label: "Careers", to: "/careers" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Security", to: "/security" },
      { label: "Subprocessors", to: "/subprocessors" },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-16 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Logo className="max-w-32" />
            </Link>
            <p className="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-text-muted">
              Turn inbound into revenue. AI that replies, quotes, follows up,
              and closes — automatically.
            </p>
          </div>
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <p className="label-sm mb-4 text-text-muted">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="link-underline text-sm text-text-dim transition-colors duration-200 hover:text-text"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-[12px] text-text-dim sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Inboundr</span>
          <div className="flex gap-5">
            <a href="#" className="transition-colors duration-200 hover:text-text" aria-label="X">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" className="transition-colors duration-200 hover:text-text" aria-label="LinkedIn">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
