import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ChevronUp } from "lucide-react"
import WallpaperLayer from "./WallpaperLayer"

export default function LockScreen({ wallpaper, onUnlock }: { wallpaper: string; onUnlock: () => void }) {
  const reduceMotion = useReducedMotion()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = () => onUnlock()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onUnlock])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: "-100%" }}
      transition={{ duration: reduceMotion ? 0.3 : 0.55, ease: [0.3, 0.9, 0.3, 1] }}
      onClick={onUnlock}
      className="absolute inset-0 z-[9500] cursor-pointer select-none overflow-hidden bg-base"
      role="button"
      aria-label="Unlock InboundrOS"
    >
      <WallpaperLayer id={wallpaper} />
      {/* Legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

      <div className="absolute inset-x-0 top-[16%] flex flex-col items-center gap-1">
        <motion.p
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="text-[clamp(4rem,12vw,7.5rem)] font-light leading-none tracking-[-0.04em] text-text [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]"
        >
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-lg font-medium text-text/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]"
        >
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-2 text-text/80"
      >
        {!reduceMotion && (
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronUp className="size-5" />
          </motion.span>
        )}
        <p className="text-[13px] font-medium [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
          Click anywhere or press any key
        </p>
      </motion.div>
    </motion.div>
  )
}
