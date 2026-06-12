import * as React from "react"

import { cn } from "@/lib/utils"

const TRIGGER_CLICKS = 5
const CLICK_WINDOW_MS = 1500
const CELEBRATION_MS = 900

interface Particle {
  dx: string
  dy: string
  delay: string
  size: number
  color: string
}

function makeParticles(): Particle[] {
  const colors = ["var(--primary)", "color-mix(in oklab, var(--primary) 70%, white)", "color-mix(in oklab, var(--primary) 80%, black)"]
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const distance = 18 + Math.random() * 14
    return {
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${Math.sin(angle) * distance}px`,
      delay: `${Math.random() * 80}ms`,
      size: 3 + Math.round(Math.random() * 2),
      color: colors[i % colors.length],
    }
  })
}

export function ProBadge({ className }: { className?: string }) {
  const clickTimesRef = React.useRef<number[]>([])
  const timeoutRef = React.useRef<number | null>(null)
  const [particles, setParticles] = React.useState<Particle[] | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleClick(event: React.MouseEvent) {
    // The sidebar badge sits inside the logo link; don't navigate.
    event.preventDefault()
    event.stopPropagation()

    const now = Date.now()
    clickTimesRef.current = [...clickTimesRef.current.filter((time) => now - time < CLICK_WINDOW_MS), now]
    if (clickTimesRef.current.length < TRIGGER_CLICKS || particles) return

    clickTimesRef.current = []
    setParticles(makeParticles())
    timeoutRef.current = window.setTimeout(() => {
      setParticles(null)
      timeoutRef.current = null
    }, CELEBRATION_MS)
  }

  return (
    <span className={cn("relative inline-flex shrink-0", className)} onClick={handleClick}>
      <span
        className={cn(
          "inline-flex items-center rounded-[5px] bg-primary px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-primary-foreground select-none",
          particles && "pro-badge-pop"
        )}
      >
        Pro
      </span>
      {particles && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {particles.map((particle, index) => (
            <span
              key={index}
              className="pro-badge-sparkle absolute top-1/2 left-1/2 rounded-full opacity-0"
              style={{
                width: particle.size,
                height: particle.size,
                marginTop: -particle.size / 2,
                marginLeft: -particle.size / 2,
                backgroundColor: particle.color,
                animationDelay: particle.delay,
                "--dx": particle.dx,
                "--dy": particle.dy,
              } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  )
}
