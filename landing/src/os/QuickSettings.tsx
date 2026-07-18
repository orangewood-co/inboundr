import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Image, Lock, Moon, Sun, Volume2, VolumeX, Wifi, Zap } from "lucide-react"
import { useOs } from "./context"

const EASE = [0.25, 1, 0.5, 1] as const

function Slider({
  value,
  min,
  max,
  onChange,
  label,
  icon,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  label: string
  icon: React.ReactNode
}) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <span className="text-text-muted">{icon}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="os-slider"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
    </div>
  )
}

export default function QuickSettings({ onClose }: { onClose: () => void }) {
  const { brightness, setBrightness, animations, setAnimations, openApp, sleep } = useOs()
  const [volume, setVolume] = useState(65)
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="os-acrylic absolute bottom-full right-2 mb-3 w-[340px] max-w-[calc(100vw-16px)] rounded-xl border border-white/10 p-5"
      role="dialog"
      aria-label="Quick settings"
    >
      {/* Toggle tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-md bg-green-bright/90 text-base transition-transform duration-150 active:scale-95"
          title="Connected to inboundr-5G"
        >
          <Wifi className="size-4" strokeWidth={2} />
          <span className="text-[10px] font-semibold">Wi-Fi</span>
        </button>
        <button
          type="button"
          onClick={() => setAnimations(!animations)}
          aria-pressed={!animations}
          title="Reduce OS animations"
          className={`flex h-[52px] flex-col items-center justify-center gap-1 rounded-md transition-all duration-150 active:scale-95 ${
            !animations ? "bg-green-bright/90 text-base" : "bg-white/[0.07] text-text hover:bg-white/[0.12]"
          }`}
        >
          <Zap className="size-4" strokeWidth={2} />
          <span className="text-[10px] font-semibold">Less motion</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            sleep()
          }}
          title="Lock the screen"
          className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-md bg-white/[0.07] text-text transition-all duration-150 hover:bg-white/[0.12] active:scale-95"
        >
          <Lock className="size-4" strokeWidth={2} />
          <span className="text-[10px] font-semibold">Lock</span>
        </button>
      </div>

      {/* Sliders */}
      <div className="mt-5 space-y-4">
        <Slider
          value={brightness}
          min={30}
          max={100}
          onChange={setBrightness}
          label="Brightness"
          icon={brightness > 60 ? <Sun className="size-4" /> : <Moon className="size-4" />}
        />
        <Slider
          value={volume}
          min={0}
          max={100}
          onChange={setVolume}
          label="Volume"
          icon={volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        />
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-3">
        <span className="text-[11px] text-text-dim">Inboundr Power — 100% and closing deals</span>
        <button
          type="button"
          onClick={() => {
            onClose()
            openApp("settings", { page: "personalization" })
          }}
          title="Change wallpaper"
          className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-white/10 hover:text-text"
        >
          <Image className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </motion.div>
  )
}
