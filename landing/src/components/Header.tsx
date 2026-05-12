import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import Logo from "./Logo"

export default function Header() {
  return (
    <>
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
    </>
  )
}
