import { Link, Outlet, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { ArrowRight } from "lucide-react"

function Logo({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M10 10H17.2C23.1647 10 28 14.8353 28 20.8V28H10V10Z"
        fill="currentColor"
        opacity="0.4"
      />
      <path
        d="M4.076 7.408C3.044 7.408 2.276 7.192 1.772 6.76C1.268 6.304 1.016 5.644 1.016 4.78C1.016 3.892 1.268 3.232 1.772 2.8C2.276 2.344 3.044 2.116 4.076 2.116C5.108 2.116 5.876 2.344 6.38 2.8C6.884 3.232 7.136 3.892 7.136 4.78C7.136 5.644 6.884 6.304 6.38 6.76C5.876 7.192 5.108 7.408 4.076 7.408ZM6.524 10V28H1.592V10H6.524Z"
        fill="currentColor"
      />
    </svg>
  )
}

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
    ],
  },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-base text-text">
      <ScrollToTop />

      {/* ── Banner ── */}
      <div className="noise relative z-50 overflow-hidden bg-green px-4 py-2 text-center text-[13px] tracking-wide">
        <span className="relative z-10 text-text-muted">AI Revenue Engine</span>
        <span className="relative z-10 mx-2 text-text-dim">|</span>
        <Link
          to="/#features"
          className="relative z-10 font-medium text-text transition hover:text-gold"
        >
          See what it does <ArrowRight className="mb-px inline size-3" />
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-base/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Logo />
            inboundr
          </Link>
          <div className="hidden gap-8 text-[13px] text-text-muted md:flex">
            <Link to="/#features" className="transition hover:text-text">
              Features
            </Link>
            <Link to="/#proof" className="transition hover:text-text">
              Proof
            </Link>
            <Link to="/about" className="transition hover:text-text">
              About
            </Link>
            <Link to="/contact" className="transition hover:text-text">
              Contact
            </Link>
          </div>
          <Link
            to="/contact"
            className="border border-border bg-surface px-4 py-1.5 text-[13px] font-medium transition hover:border-text/20 hover:bg-surface-raised"
          >
            Get access
          </Link>
        </div>
      </nav>

      {/* ── Page content ── */}
      <Outlet />

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Logo />
                inboundr
              </Link>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
                Turn inbound into revenue. AI that replies, quotes, follows up,
                and closes — automatically.
              </p>
            </div>
            {footerLinks.map((col) => (
              <div key={col.heading}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                  {col.heading}
                </p>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        className="text-sm text-text-dim transition hover:text-text"
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
              <a href="#" className="transition hover:text-text" aria-label="X">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="transition hover:text-text" aria-label="LinkedIn">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
