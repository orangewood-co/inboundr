export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L"
export type Cell = PieceType | null
export type Board = Cell[][]

export interface ActivePiece {
  type: PieceType
  rotation: number
  x: number
  y: number
}

export const COLS = 10
export const ROWS = 20

/**
 * Piece colours stay inside Inboundr's green/gold family (instead of the
 * classic Tetris palette) while staying distinguishable by hue + lightness.
 */
export const PIECE_COLORS: Record<PieceType, string> = {
  I: "#3ecf8e", // green-bright
  O: "#efc554", // gold
  T: "#67d6a6", // mint
  S: "#a8e06a", // lime
  Z: "#2f9d77", // deep green
  J: "#cdd45a", // chartreuse
  L: "#4cc0c9", // teal
}

const BASE_SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

function rotateCW(matrix: number[][]): number[][] {
  const rows = matrix.length
  const cols = matrix[0].length
  const result: number[][] = Array.from({ length: cols }, () => Array<number>(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = matrix[r][c]
    }
  }
  return result
}

function buildRotations(base: number[][]): number[][][] {
  const rotations = [base]
  for (let i = 0; i < 3; i++) rotations.push(rotateCW(rotations[i]))
  return rotations
}

export const SHAPES: Record<PieceType, number[][][]> = Object.fromEntries(
  (Object.keys(BASE_SHAPES) as PieceType[]).map((type) => [type, buildRotations(BASE_SHAPES[type])]),
) as Record<PieceType, number[][][]>

/** Filled cell offsets `[x, y]` for a piece at a given rotation. */
export function pieceCells(type: PieceType, rotation: number): Array<[number, number]> {
  const matrix = SHAPES[type][rotation % SHAPES[type].length]
  const cells: Array<[number, number]> = []
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x]) cells.push([x, y])
    }
  }
  return cells
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))
}

export function collides(board: Board, piece: ActivePiece): boolean {
  for (const [dx, dy] of pieceCells(piece.type, piece.rotation)) {
    const x = piece.x + dx
    const y = piece.y + dy
    if (x < 0 || x >= COLS || y >= ROWS) return true
    // y < 0 is allowed so pieces can spawn / rotate partly above the field.
    if (y >= 0 && board[y][x]) return true
  }
  return false
}

export function mergePiece(board: Board, piece: ActivePiece): Board {
  const next = board.map((row) => row.slice())
  for (const [dx, dy] of pieceCells(piece.type, piece.rotation)) {
    const x = piece.x + dx
    const y = piece.y + dy
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.type
  }
  return next
}

export function fullRows(board: Board): number[] {
  const rows: number[] = []
  for (let y = 0; y < board.length; y++) {
    if (board[y].every((cell) => cell !== null)) rows.push(y)
  }
  return rows
}

export function clearRows(board: Board, rows: number[]): Board {
  if (rows.length === 0) return board
  const cleared = new Set(rows)
  const remaining = board.filter((_, y) => !cleared.has(y))
  const empty: Board = Array.from({ length: rows.length }, () => Array<Cell>(COLS).fill(null))
  return [...empty, ...remaining]
}

// Pieces with an empty leading matrix row (only "I") spawn one row higher so
// their first visible cells land on row 0.
const SPAWN_OFFSET: Record<PieceType, number> = { I: -1, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 }

export function spawnPiece(type: PieceType): ActivePiece {
  const width = SHAPES[type][0][0].length
  return {
    type,
    rotation: 0,
    x: Math.floor((COLS - width) / 2),
    y: SPAWN_OFFSET[type],
  }
}

const KICK_OFFSETS = [0, -1, 1, -2, 2]

export function rotatePiece(board: Board, piece: ActivePiece, dir: 1 | -1 = 1): ActivePiece {
  const total = SHAPES[piece.type].length
  const rotation = (piece.rotation + dir + total) % total
  const rotated = { ...piece, rotation }
  for (const dx of KICK_OFFSETS) {
    const candidate = { ...rotated, x: rotated.x + dx }
    if (!collides(board, candidate)) return candidate
  }
  return piece
}

export function getGhostY(board: Board, piece: ActivePiece): number {
  let y = piece.y
  while (!collides(board, { ...piece, y: y + 1 })) y++
  return y
}

/** Shuffled 7-bag so every piece appears once before any repeats. */
export function createBag(): PieceType[] {
  const bag: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export const LINE_SCORES = [0, 100, 300, 500, 800]

export function levelFromLines(lines: number): number {
  return Math.floor(lines / 10) + 1
}

export function dropInterval(level: number): number {
  return Math.max(90, 800 - (level - 1) * 65)
}
