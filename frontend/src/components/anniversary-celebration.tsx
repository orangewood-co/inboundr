import * as React from "react"
import { PartyPopperIcon } from "lucide-react"

const CONFETTI_COLORS = ["#fcd34d", "#fbbf24", "#f59e0b", "#d6d3d1", "#a8a29e"]
const CONFETTI_CLEANUP_MS = 4400

interface ConfettiPiece {
  left: string
  fall: string
  sway: string
  spin: string
  delay: string
  duration: string
  width: number
  height: number
  color: string
}

function anniversaryYears(startDate: string | null): number {
  if (!startDate) return 0
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return 0
  const now = new Date()
  const years = now.getFullYear() - start.getFullYear()
  if (years < 1) return 0
  if (start.getMonth() !== now.getMonth() || start.getDate() !== now.getDate()) return 0
  return years
}

function makePieces(): ConfettiPiece[] {
  return Array.from({ length: 20 }, (_, i) => {
    const square = Math.random() < 0.4
    return {
      left: `${Math.random() * 100}%`,
      fall: `${110 + Math.random() * 60}px`,
      sway: `${(Math.random() - 0.5) * 48}px`,
      spin: `${Math.random() < 0.5 ? "-" : ""}${180 + Math.round(Math.random() * 540)}deg`,
      delay: `${Math.round(Math.random() * 600)}ms`,
      duration: `${(2.2 + Math.random() * 1.4).toFixed(2)}s`,
      width: square ? 5 : 4,
      height: square ? 5 : 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }
  })
}

/**
 * Easter egg: on the anniversary of `startDate` (month/day match, at least one
 * full year later), shows a one-shot confetti fall plus a small caption.
 * Renders nothing on every other day. The confetti overlay positions against
 * the nearest `relative` ancestor.
 */
export function AnniversaryCelebration({ startDate }: { startDate: string | null }) {
  const years = React.useMemo(() => anniversaryYears(startDate), [startDate])
  if (!years) return null

  return <AnniversaryCelebrationContent key={`${startDate}-${years}`} years={years} />
}

function AnniversaryCelebrationContent({ years }: { years: number }) {
  const [pieces, setPieces] = React.useState<ConfettiPiece[] | null>(() => makePieces())

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setPieces(null), CONFETTI_CLEANUP_MS)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
        <PartyPopperIcon className="size-3.5" />
        {years} {years === 1 ? "year" : "years"} today
      </p>
      {pieces && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {pieces.map((piece, index) => (
            <span
              key={index}
              className="anniversary-confetti absolute -top-2 rounded-[1px] opacity-0"
              style={{
                left: piece.left,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
                "--fall": piece.fall,
                "--sway": piece.sway,
                "--spin": piece.spin,
                "--delay": piece.delay,
                "--duration": piece.duration,
              } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </>
  )
}
