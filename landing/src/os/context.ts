import { createContext, useContext } from "react"
import type { AppId } from "./types"

export interface OsContextValue {
  openApp: (appId: AppId, payload?: unknown) => void
  closeWindow: (id: number) => void
  wallpaper: string
  setWallpaper: (id: string) => void
  /** Screen brightness, 30–100. Drives a dark overlay over the whole OS. */
  brightness: number
  setBrightness: (value: number) => void
  /** OS-level animations toggle (Settings > System). */
  animations: boolean
  setAnimations: (enabled: boolean) => void
  isMobile: boolean
  /** Power actions. */
  sleep: () => void
  restart: () => void
  shutdown: () => void
}

export const OsContext = createContext<OsContextValue | null>(null)

export function useOs(): OsContextValue {
  const ctx = useContext(OsContext)
  if (!ctx) throw new Error("useOs must be used inside the OS desktop")
  return ctx
}
