import { motion } from "motion/react"

export function ProgressBar({
  current,
  total,
  accent,
}: {
  current: number
  total: number
  accent: string
}) {
  const progress = total > 0 ? Math.min((current / total) * 100, 100) : 0

  return (
    <div className="fixed top-0 right-0 left-0 z-50 h-1 bg-stone-200/60">
      <motion.div
        className="h-full rounded-r-full"
        style={{ backgroundColor: accent }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  )
}
