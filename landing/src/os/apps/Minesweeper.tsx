import { useEffect, useState } from "react"
import { Flag, RotateCcw } from "lucide-react"

const ROWS = 9
const COLS = 9
const MINES = 10

interface Cell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

type Board = Cell[][]
type GameState = "fresh" | "playing" | "won" | "lost"

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  )
}

function neighbors(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push([nr, nc])
    }
  }
  return out
}

/** Place mines after the first click so the opener is always safe. */
function seedMines(board: Board, safeR: number, safeC: number): Board {
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  let placed = 0
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS)
    const c = Math.floor(Math.random() * COLS)
    if (next[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue
    next[r][c].mine = true
    placed++
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      next[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => next[nr][nc].mine).length
    }
  }
  return next
}

function floodReveal(board: Board, r: number, c: number) {
  const stack: Array<[number, number]> = [[r, c]]
  while (stack.length) {
    const [cr, cc] = stack.pop()!
    const cell = board[cr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adjacent === 0 && !cell.mine) {
      for (const [nr, nc] of neighbors(cr, cc)) {
        if (!board[nr][nc].revealed) stack.push([nr, nc])
      }
    }
  }
}

const NUMBER_COLORS = [
  "",
  "text-[#7db3e8]",
  "text-[#7dd8a0]",
  "text-[#e08c7d]",
  "text-[#b48ce0]",
  "text-gold",
  "text-[#7dd8d8]",
  "text-text",
  "text-text-dim",
]

export default function MinesweeperApp() {
  const [board, setBoard] = useState<Board>(emptyBoard)
  const [state, setState] = useState<GameState>("fresh")
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (state !== "playing") return
    const id = window.setInterval(() => setSeconds((s) => Math.min(s + 1, 999)), 1000)
    return () => window.clearInterval(id)
  }, [state])

  const flags = board.flat().filter((c) => c.flagged).length
  const minesLeft = state === "fresh" ? MINES : MINES - flags

  const reset = () => {
    setBoard(emptyBoard())
    setState("fresh")
    setSeconds(0)
  }

  const checkWin = (b: Board): boolean =>
    b.flat().every((cell) => cell.revealed || cell.mine)

  const reveal = (r: number, c: number) => {
    if (state === "won" || state === "lost") return
    let next: Board
    if (state === "fresh") {
      next = seedMines(board, r, c)
      setState("playing")
    } else {
      next = board.map((row) => row.map((cell) => ({ ...cell })))
    }
    const cell = next[r][c]
    if (cell.flagged || cell.revealed) {
      setBoard(next)
      return
    }
    if (cell.mine) {
      next.forEach((row) => row.forEach((x) => { if (x.mine) x.revealed = true }))
      setBoard(next)
      setState("lost")
      return
    }
    floodReveal(next, r, c)
    setBoard(next)
    if (checkWin(next)) setState("won")
  }

  const flag = (r: number, c: number) => {
    if (state === "won" || state === "lost") return
    const next = board.map((row) => row.map((cell) => ({ ...cell })))
    const cell = next[r][c]
    if (!cell.revealed) cell.flagged = !cell.flagged
    setBoard(next)
  }

  const face = state === "lost" ? ":(" : state === "won" ? "B)" : ":)"

  return (
    <div className="flex h-full flex-col items-center bg-base p-3">
      {/* Status bar */}
      <div className="mb-3 flex w-full max-w-[324px] items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[13px] text-[#e08c7d]">
          <Flag className="size-3.5" /> {String(minesLeft).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={reset}
          title="New game"
          className="rounded-md bg-white/[0.08] px-3 py-1 font-mono text-[14px] transition-all duration-100 hover:bg-white/[0.14] active:scale-90"
        >
          {face}
        </button>
        <span className="font-mono text-[13px] text-text-muted">{String(seconds).padStart(3, "0")}</span>
      </div>

      {/* Grid */}
      <div
        className="grid select-none gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, width: "min(100%, 324px)" }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              onClick={() => reveal(r, c)}
              onContextMenu={(e) => {
                e.preventDefault()
                flag(r, c)
              }}
              className={`flex aspect-square items-center justify-center rounded-[4px] font-mono text-[13px] font-bold leading-none transition-colors duration-75 ${
                cell.revealed
                  ? cell.mine
                    ? "bg-[#c42b1c]/70 text-text"
                    : "bg-white/[0.04] " + (cell.adjacent > 0 ? NUMBER_COLORS[cell.adjacent] : "")
                  : "bg-white/[0.1] hover:bg-white/[0.16]"
              }`}
            >
              {cell.revealed
                ? cell.mine
                  ? "✷"
                  : cell.adjacent > 0
                    ? cell.adjacent
                    : ""
                : cell.flagged
                  ? "⚑"
                  : ""}
            </button>
          )),
        )}
      </div>

      {/* Status line */}
      <p className="mt-3 font-mono text-[11px] text-text-dim">
        {state === "lost"
          ? "You clicked a risky lead. Inboundr would have flagged it."
          : state === "won"
            ? "Pipeline cleared. Not a single bad lead touched."
            : "left-click to qualify · right-click to flag risky leads"}
      </p>
    </div>
  )
}
