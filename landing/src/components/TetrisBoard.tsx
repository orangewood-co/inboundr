import { motion } from "motion/react"
import {
  type ActivePiece,
  type Board,
  type BoardLayout,
  PIECE_COLORS,
  pieceCells,
  ROWS,
} from "@/lib/tetris"

interface TetrisBoardProps {
  board: Board
  active: ActivePiece | null
  ghostY: number | null
  clearing: number[]
  reduceMotion: boolean
  layout: BoardLayout
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

export function TetrisBoard({
  board,
  active,
  ghostY,
  clearing,
  reduceMotion,
  layout,
}: TetrisBoardProps) {
  // The board's column count is locked when a game starts; the layout only
  // drives cell size on resize. Derive the play area from the actual board so
  // a window resize never desyncs the rendered boundaries from the game state.
  const cols = board[0].length
  // If a locked board is wider than the current viewport allows, shrink the
  // cell so it stays fully visible (instead of clipping) until the next restart.
  const cell = cols > layout.totalCols ? Math.max(8, Math.floor(layout.width / cols)) : layout.cell
  const totalCols = Math.max(layout.totalCols, cols)
  const startCol = Math.floor((totalCols - cols) / 2)
  const height = cell * ROWS
  const activeCells = active ? pieceCells(active.type, active.rotation) : []

  return (
    <div
      className="relative w-full overflow-hidden bg-base"
      style={{ height }}
      role="img"
      aria-label="404 Tetris playfield"
    >
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
        style={{ left: startCol * cell, width: cols * cell }}
      />
      <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: startCol * cell }} />
      <div
        className="absolute top-0 bottom-0 w-px bg-border"
        style={{ left: (startCol + cols) * cell }}
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
            style={{ left: startCol * cell, top: row * cell, width: cols * cell, height: cell }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.17, ease: "easeOut" }}
          />
        ))}
    </div>
  )
}
