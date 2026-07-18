import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Logo from "./Logo"

const navLinks = [
  { to: "/features", label: "Features" },
  { to: "/#proof", label: "Proof" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Banner ── */}
      <div className="noise relative z-50 overflow-hidden bg-green px-4 py-2 text-center text-[13px] tracking-wide">
        <span className="relative z-10 text-text-muted">Meet InboundrOS — our site, reimagined as a desktop</span>
        <span className="relative z-10 mx-2 text-text-dim">|</span>
        <Link
          to="/os"
          className="relative z-10 font-medium text-text transition-colors duration-200 hover:text-gold"
        >
          Boot it up <ArrowRight className="mb-px inline size-3" />
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-base/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Logo />
          </Link>
          <div className="hidden gap-8 text-[13px] text-text-muted md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="link-underline transition-colors duration-200 hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="https://app.inboundr.co/"
              className="inline-block border border-border bg-green px-4 py-1.5 text-[13px] font-medium transition-[transform,border-color,background-color] duration-200 ease-out hover:border-text/20 hover:bg-surface-raised active:scale-[0.97]"
            >
              Login
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex size-9 items-center justify-center text-text-muted transition-[color,transform] duration-200 ease-out hover:text-text active:scale-95 md:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="overflow-hidden border-t border-border md:hidden"
            >
              <div className="flex flex-col gap-1 px-6 py-4">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <Link
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className="block py-3 text-sm font-medium text-text-muted transition-colors duration-200 hover:text-text"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  )
}
