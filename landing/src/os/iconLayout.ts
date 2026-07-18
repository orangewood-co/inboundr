/** Desktop icon slot-grid layout persistence. */

export interface IconSlot {
  col: number
  row: number
}

export type IconPositions = Record<string, IconSlot>

const POSITIONS_KEY = "inboundr-os-icon-positions"

export function loadIconPositions(): IconPositions {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    const result: IconPositions = {}
    for (const [id, slot] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof slot === "object" &&
        slot !== null &&
        typeof (slot as IconSlot).col === "number" &&
        typeof (slot as IconSlot).row === "number"
      ) {
        result[id] = { col: (slot as IconSlot).col, row: (slot as IconSlot).row }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveIconPositions(positions: IconPositions) {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions))
  } catch {
    // Non-fatal: the arrangement just won't survive a reload.
  }
}

export function clearIconPositions() {
  try {
    localStorage.removeItem(POSITIONS_KEY)
  } catch {
    // Non-fatal.
  }
}
