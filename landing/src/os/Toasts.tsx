import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { X } from "lucide-react"
import type { OsToast } from "./context"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"

const EASE = [0.25, 1, 0.5, 1] as const

export default function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: OsToast[]
  onDismiss: (id: number) => void
}) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      className="pointer-events-none absolute right-3 z-[9200] flex w-[340px] max-w-[calc(100vw-24px)] flex-col items-end gap-2"
      style={{ bottom: OS_TASKBAR_HEIGHT + 12 }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout={!reduceMotion}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="os-acrylic pointer-events-auto w-full rounded-lg border border-white/10 p-3.5 shadow-lg"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-green">
                <img src="/mark.png" alt="" className="size-4 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold leading-snug">{toast.title}</p>
                {toast.message && (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-text-muted">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(toast.id)}
                className="flex size-6 shrink-0 items-center justify-center rounded text-text-dim transition-colors duration-150 hover:bg-white/10 hover:text-text"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
