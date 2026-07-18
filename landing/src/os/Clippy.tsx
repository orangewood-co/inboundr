import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"

const APPEAR_AFTER_MS = 50_000

/** A hand-drawn paperclip. He has seen things. */
function Paperclip() {
  return (
    <svg viewBox="0 0 48 64" className="h-16 w-12" aria-hidden>
      <path
        d="M16 46 V14 a8 8 0 0 1 16 0 v28 a14 14 0 0 1 -28 0 V18"
        fill="none"
        stroke="#c9cdd4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="2.6" fill="#1a1d1b" />
      <circle cx="29" cy="20" r="2.6" fill="#1a1d1b" />
      <path d="M21 28 q3.5 3 8 0" fill="none" stroke="#1a1d1b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function Clippy() {
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const id = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [dismissed])

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="absolute right-6 z-[9250] flex items-end gap-3"
          style={{ bottom: OS_TASKBAR_HEIGHT + 16 }}
          role="dialog"
          aria-label="Assistant"
        >
          <div className="os-acrylic relative max-w-[260px] rounded-xl rounded-br-none border border-white/10 p-4">
            <p className="text-[13px] leading-relaxed">
              It looks like you're trying to close a deal.
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed">Inboundr already did.</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-3 w-full rounded-md border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 hover:bg-white/[0.14]"
            >
              He's right.
            </button>
          </div>
          <motion.div
            animate={reduceMotion ? undefined : { rotate: [0, -6, 5, -3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
          >
            <Paperclip />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
