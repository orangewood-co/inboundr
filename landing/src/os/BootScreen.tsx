import { useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"
import { preloadOsAssets } from "./wallpapers"

const MIN_BOOT_MS = 1800

export default function BootScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    const minDelay = new Promise<void>((resolve) =>
      window.setTimeout(resolve, reduceMotion ? 600 : MIN_BOOT_MS),
    )
    Promise.all([preloadOsAssets(), minDelay]).then(() => {
      if (!cancelled) onDone()
    })
    return () => {
      cancelled = true
    }
  }, [onDone, reduceMotion])

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      className="absolute inset-0 z-[9600] flex flex-col items-center bg-black"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <motion.img
          src="/mark.png"
          alt="Inboundr"
          draggable={false}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="size-20 object-contain"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm font-medium tracking-wide text-text-muted"
        >
          InboundrOS
        </motion.p>
      </div>

      {/* Spinner sits in the lower third, like a real Windows boot. */}
      <div className="mb-24 flex flex-col items-center gap-5">
        <div className="os-spinner size-8" role="status" aria-label="Starting InboundrOS">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <p className="text-[13px] text-text-dim">Getting things ready</p>
      </div>
    </motion.div>
  )
}
