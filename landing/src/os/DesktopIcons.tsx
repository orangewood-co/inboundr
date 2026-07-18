import { motion, useReducedMotion } from "motion/react"
import { APPS } from "./apps/registry"
import type { AppId } from "./types"

interface DesktopIconsProps {
  onLaunch: (appId: AppId) => void
}

export default function DesktopIcons({ onLaunch }: DesktopIconsProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="absolute left-3 top-3 z-0 grid grid-flow-col grid-rows-[repeat(auto-fill,88px)] gap-1 sm:left-5 sm:top-5">
      {APPS.map((app, i) => (
        <motion.button
          key={app.id}
          type="button"
          onClick={() => onLaunch(app.id)}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1], delay: 0.4 + i * 0.05 }}
          className="flex h-[84px] w-20 flex-col items-center justify-center gap-2 border border-transparent transition-colors duration-200 hover:border-border hover:bg-white/[0.03]"
        >
          <app.icon className="size-6 text-text-muted" strokeWidth={1.25} />
          <span className="max-w-full truncate px-1 text-[11px] font-medium text-text-muted">
            {app.name}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
