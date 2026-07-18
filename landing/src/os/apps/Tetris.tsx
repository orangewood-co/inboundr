import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { ArrowDown, ArrowLeft, ArrowRight, Pause, Play, RotateCw } from "lucide-react"
import { TetrisBoard } from "@/components/TetrisBoard"
import { useTetris } from "@/hooks/useTetris"
import { type BoardLayout, MIN_COLS, ROWS } from "@/lib/tetris"
import type { AppProps } from "../types"

const HUD_H = 40
const CONTROLS_H = 48

/**
 * Window-sized variant of computeBoardLayout: the playfield fills the app's
 * content box instead of the browser viewport.
 */
function computeWindowLayout(w: number, h: number): BoardLayout {
  const cell = Math.max(10, Math.min(Math.floor(h / ROWS), Math.floor(w / MIN_COLS), 34))
  const totalCols = Math.max(MIN_COLS, Math.floor(w / cell))
  return { cell, cols: totalCols, totalCols, startCol: 0, width: totalCols * cell, height: cell * ROWS }
}

function TouchButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="flex h-9 flex-1 items-center justify-center rounded-md border border-white/[0.08] text-text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-text active:bg-white/[0.12]"
    >
      {children}
    </button>
  )
}

export default function TetrisApp({ focused }: AppProps) {
  const reduceMotion = useReducedMotion()
  const boardAreaRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<BoardLayout>(() => computeWindowLayout(420, 400))

  useLayoutEffect(() => {
    const el = boardAreaRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setLayout(computeWindowLayout(rect.width, rect.height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const game = useTetris(layout.cols)
  const { status, score, lines, level, board, active, ghostY, clearing, actions } = game

  // Pause when the window loses focus (another app on top, or minimized) so
  // pieces don't drop while the user is elsewhere on the desktop.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    if (!focused && statusRef.current === "playing") actions.togglePause()
  }, [focused, actions])

  return (
    <div className="flex h-full flex-col bg-base">
      {/* HUD */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-border px-4 font-mono text-[11px] text-text-muted"
        style={{ height: HUD_H }}
      >
        <span>
          score <span className="text-text">{score}</span>
        </span>
        <span>
          lines <span className="text-text">{lines}</span>
        </span>
        <span>
          level <span className="text-gold">{level}</span>
        </span>
        <button
          type="button"
          aria-label={status === "paused" ? "Resume" : "Pause"}
          onClick={actions.togglePause}
          className="flex size-6 items-center justify-center text-text-dim transition-colors duration-200 hover:text-text"
        >
          {status === "paused" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      </div>

      {/* Playfield */}
      <div ref={boardAreaRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-start justify-center">
          <TetrisBoard
            board={board}
            active={active}
            ghostY={ghostY}
            clearing={clearing}
            reduceMotion={!!reduceMotion}
            layout={layout}
          />
        </div>

        {(status === "paused" || status === "over") && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-base/80">
            <p className="font-display text-2xl italic text-gold">
              {status === "over" ? "Game over" : "Paused"}
            </p>
            {status === "over" && (
              <p className="font-mono text-[12px] text-text-muted">
                {score} points · {lines} lines
              </p>
            )}
            <button
              type="button"
              onClick={status === "over" ? actions.restart : actions.togglePause}
              className="rounded-md border border-white/[0.12] px-5 py-2 text-[13px] font-semibold transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.06]"
            >
              {status === "over" ? "Play again" : "Resume"}
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-border px-3 py-1.5" style={{ height: CONTROLS_H }}>
        <div className="flex h-full items-center gap-1.5">
          <TouchButton label="Move left" onPress={actions.moveLeft}>
            <ArrowLeft className="size-4" />
          </TouchButton>
          <TouchButton label="Rotate" onPress={actions.rotate}>
            <RotateCw className="size-4" />
          </TouchButton>
          <TouchButton label="Move right" onPress={actions.moveRight}>
            <ArrowRight className="size-4" />
          </TouchButton>
          <TouchButton label="Hard drop" onPress={actions.hardDrop}>
            <ArrowDown className="size-4" />
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
