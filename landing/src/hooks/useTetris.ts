import { useEffect, useMemo, useReducer, useRef } from "react"
import { useReducedMotion } from "motion/react"
import {
  type ActivePiece,
  type Board,
  type PieceType,
  clearRows,
  collides,
  createBag,
  createBoard,
  dropInterval,
  fullRows,
  getGhostY,
  levelFromLines,
  LINE_SCORES,
  mergePiece,
  rotatePiece,
  spawnPiece,
} from "@/lib/tetris"

export type GameStatus = "ready" | "playing" | "paused" | "clearing" | "over"

interface GameState {
  board: Board
  active: ActivePiece | null
  queue: PieceType[]
  next: PieceType | null
  score: number
  lines: number
  level: number
  status: GameStatus
  clearing: number[]
}

type Action =
  | { type: "START" }
  | { type: "RESTART" }
  | { type: "TICK" }
  | { type: "MOVE"; dir: -1 | 1 }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "ROTATE"; dir: 1 | -1 }
  | { type: "PAUSE_TOGGLE" }
  | { type: "COLLAPSE" }

function initialState(): GameState {
  return {
    board: createBoard(),
    active: null,
    queue: [],
    next: null,
    score: 0,
    lines: 0,
    level: 1,
    status: "ready",
    clearing: [],
  }
}

function spawnNext(state: GameState): GameState {
  let queue = state.queue.slice()
  if (queue.length < 8) queue = [...queue, ...createBag()]
  const type = queue.shift() as PieceType
  const piece = spawnPiece(type)
  const next = queue[0] ?? null
  if (collides(state.board, piece)) {
    return { ...state, active: null, queue, next, status: "over" }
  }
  return { ...state, active: piece, queue, next, status: "playing" }
}

function lockPiece(state: GameState, piece: ActivePiece): GameState {
  const board = mergePiece(state.board, piece)
  const cleared = fullRows(board)
  if (cleared.length > 0) {
    // Keep the full rows on the board momentarily so they can flash, then
    // COLLAPSE removes them and spawns the next piece.
    return { ...state, board, active: null, clearing: cleared, status: "clearing" }
  }
  return spawnNext({ ...state, board, active: null })
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START":
      if (state.status !== "ready") return state
      return spawnNext({ ...initialState(), status: "playing" })
    case "RESTART":
      return spawnNext({ ...initialState(), status: "playing" })
    case "TICK": {
      if (state.status !== "playing" || !state.active) return state
      const moved = { ...state.active, y: state.active.y + 1 }
      if (!collides(state.board, moved)) return { ...state, active: moved }
      return lockPiece(state, state.active)
    }
    case "SOFT_DROP": {
      if (state.status !== "playing" || !state.active) return state
      const moved = { ...state.active, y: state.active.y + 1 }
      if (!collides(state.board, moved)) return { ...state, active: moved, score: state.score + 1 }
      return lockPiece(state, state.active)
    }
    case "HARD_DROP": {
      if (state.status !== "playing" || !state.active) return state
      let piece = state.active
      let distance = 0
      while (!collides(state.board, { ...piece, y: piece.y + 1 })) {
        piece = { ...piece, y: piece.y + 1 }
        distance++
      }
      return lockPiece({ ...state, score: state.score + distance * 2 }, piece)
    }
    case "MOVE": {
      if (state.status !== "playing" || !state.active) return state
      const moved = { ...state.active, x: state.active.x + action.dir }
      return collides(state.board, moved) ? state : { ...state, active: moved }
    }
    case "ROTATE": {
      if (state.status !== "playing" || !state.active) return state
      return { ...state, active: rotatePiece(state.board, state.active, action.dir) }
    }
    case "PAUSE_TOGGLE": {
      if (state.status === "playing") return { ...state, status: "paused" }
      if (state.status === "paused") return { ...state, status: "playing" }
      return state
    }
    case "COLLAPSE": {
      if (state.status !== "clearing") return state
      const count = state.clearing.length
      const board = clearRows(state.board, state.clearing)
      const lines = state.lines + count
      return spawnNext({
        ...state,
        board,
        clearing: [],
        lines,
        level: levelFromLines(lines),
        score: state.score + LINE_SCORES[count] * state.level,
      })
    }
    default:
      return state
  }
}

export interface TetrisActions {
  moveLeft: () => void
  moveRight: () => void
  rotate: () => void
  softDrop: () => void
  hardDrop: () => void
  restart: () => void
  togglePause: () => void
}

export interface TetrisGame extends GameState {
  ghostY: number | null
  actions: TetrisActions
}

export function useTetris(): TetrisGame {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const reduceMotion = useReducedMotion()

  const statusRef = useRef(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  // Auto-start a little after mount so the entrance animation reads first.
  useEffect(() => {
    const id = window.setTimeout(() => dispatch({ type: "START" }), 450)
    return () => window.clearTimeout(id)
  }, [])

  // Gravity loop — re-created when level (speed) or status changes.
  useEffect(() => {
    if (state.status !== "playing") return
    const id = window.setInterval(() => dispatch({ type: "TICK" }), dropInterval(state.level))
    return () => window.clearInterval(id)
  }, [state.status, state.level])

  // Hold full rows briefly to flash, then collapse them.
  useEffect(() => {
    if (state.status !== "clearing") return
    const id = window.setTimeout(() => dispatch({ type: "COLLAPSE" }), reduceMotion ? 0 : 170)
    return () => window.clearTimeout(id)
  }, [state.status, reduceMotion])

  // Pause when the tab is hidden so a piece doesn't drop while away.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && statusRef.current === "playing") dispatch({ type: "PAUSE_TOGGLE" })
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          dispatch({ type: "MOVE", dir: -1 })
          break
        case "ArrowRight":
          e.preventDefault()
          dispatch({ type: "MOVE", dir: 1 })
          break
        case "ArrowDown":
          e.preventDefault()
          dispatch({ type: "SOFT_DROP" })
          break
        case "ArrowUp":
        case "x":
        case "X":
          e.preventDefault()
          dispatch({ type: "ROTATE", dir: 1 })
          break
        case " ":
          e.preventDefault()
          dispatch({ type: "HARD_DROP" })
          break
        case "p":
        case "P":
          dispatch({ type: "PAUSE_TOGGLE" })
          break
        case "r":
        case "R":
          dispatch({ type: "RESTART" })
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const actions = useMemo<TetrisActions>(
    () => ({
      moveLeft: () => dispatch({ type: "MOVE", dir: -1 }),
      moveRight: () => dispatch({ type: "MOVE", dir: 1 }),
      rotate: () => dispatch({ type: "ROTATE", dir: 1 }),
      softDrop: () => dispatch({ type: "SOFT_DROP" }),
      hardDrop: () => dispatch({ type: "HARD_DROP" }),
      restart: () => dispatch({ type: "RESTART" }),
      togglePause: () => dispatch({ type: "PAUSE_TOGGLE" }),
    }),
    [],
  )

  const ghostY = state.active ? getGhostY(state.board, state.active) : null

  return { ...state, ghostY, actions }
}
