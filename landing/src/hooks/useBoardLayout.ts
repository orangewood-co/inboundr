import { useEffect, useState } from "react"
import { type BoardLayout, computeBoardLayout } from "@/lib/tetris"

function currentLayout(): BoardLayout {
  if (typeof window === "undefined") return computeBoardLayout(1024, 768)
  return computeBoardLayout(window.innerWidth, window.innerHeight)
}

/**
 * Single source of truth for board sizing. The playfield is full-width, so the
 * window dimensions stand in for the container and keep the game state and the
 * renderer agreeing on the column count.
 */
export function useBoardLayout(): BoardLayout {
  const [layout, setLayout] = useState<BoardLayout>(currentLayout)

  useEffect(() => {
    const measure = () => setLayout(currentLayout())
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  return layout
}
