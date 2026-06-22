import { useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  type ActivePiece,
  type Board,
  COLS,
  PIECE_COLORS,
  pieceCells,
  ROWS,
} from "@/lib/tetris"

interface Dims {
  cell: number
  totalCols: number
  startCol: number
  width: number
  height: number
}

interface TetrisBoardProps {
  board: Board
  active: ActivePiece | null
  ghostY: number | null
  clearing: number[]
  reduceMotion: boolean
}

// One shared coordinate system: the grid spans the full width, the central
// COLS columns are the play area, and side columns are decorative empty grid.
function computeDims(width: number, viewportH: number): Dims {
  const targetH = Math.max(340, Math.min(viewportH * 0.6, 660))
  let cell = Math.round(targetH / ROWS)
  cell = Math.max(15, Math.min(cell, 38))
  let totalCols = Math.floor(width / cell)
  if (totalCols < COLS) {
    cell = Math.floor(width / COLS)
    totalCols = COLS
  }
  const startCol = Math.floor((totalCols - COLS) / 2)
  return { cell, totalCols, startCol, width, height: cell * ROWS }
}

function Block({
  screenX,
  screenY,
  color,
  cell,
}: {
  screenX: number
  screenY: number
  color: string
  cell: number
}) {
  return (
    <div
      className="absolute"
      style={{ left: screenX * cell, top: screenY * cell, width: cell, height: cell }}
    >
      <div
        className="absolute inset-[1px] rounded-[2px]"
        style={{
          background: color,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 6px rgba(0,0,0,0.22)",
        }}
      />
    </div>
  )
}

export function TetrisBoard({ board, active, ghostY, clearing, reduceMotion }: TetrisBoardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<Dims | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setDims(computeDims(el.clientWidth, window.innerHeight))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const cell = dims?.cell ?? 0
  const startCol = dims?.startCol ?? 0
  const activeCells = active ? pieceCells(active.type, active.rotation) : []

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-base"
      style={{ height: dims?.height ?? "60vh" }}
      role="img"
      aria-label="404 Tetris playfield"
    >
      {dims && (
        <>
          {/* Grid lines (aligned to the same cell origin as the blocks) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: `${cell}px ${cell}px`,
            }}
          />

          {/* Play-area tint + boundaries */}
          <div
            className="absolute top-0 bottom-0 bg-white/[0.015]"
            style={{ left: startCol * cell, width: COLS * cell }}
          />
          <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: startCol * cell }} />
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: (startCol + COLS) * cell }}
          />

          {/* Ghost piece */}
          {active &&
            ghostY !== null &&
            activeCells.map(([dx, dy], i) => {
              const gx = startCol + active.x + dx
              const gy = ghostY + dy
              if (gy < 0) return null
              return (
                <div
                  key={`ghost-${i}`}
                  className="absolute"
                  style={{ left: gx * cell, top: gy * cell, width: cell, height: cell }}
                >
                  <div
                    className="absolute inset-[1px] rounded-[2px] border"
                    style={{ borderColor: PIECE_COLORS[active.type] + "33" }}
                  />
                </div>
              )
            })}

          {/* Locked stack */}
          {board.map((row, y) =>
            row.map((value, x) =>
              value ? (
                <Block
                  key={`b-${y}-${x}`}
                  screenX={startCol + x}
                  screenY={y}
                  color={PIECE_COLORS[value]}
                  cell={cell}
                />
              ) : null,
            ),
          )}

          {/* Active piece */}
          {active &&
            activeCells.map(([dx, dy], i) => {
              const py = active.y + dy
              if (py < 0) return null
              return (
                <Block
                  key={`a-${i}`}
                  screenX={startCol + active.x + dx}
                  screenY={py}
                  color={PIECE_COLORS[active.type]}
                  cell={cell}
                />
              )
            })}

          {/* Line-clear flash */}
          {!reduceMotion &&
            clearing.map((row) => (
              <motion.div
                key={`flash-${row}`}
                className="absolute bg-white"
                style={{ left: startCol * cell, top: row * cell, width: COLS * cell, height: cell }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ duration: 0.17, ease: "easeOut" }}
              />
            ))}
        </>
      )}
    </div>
  )
}
