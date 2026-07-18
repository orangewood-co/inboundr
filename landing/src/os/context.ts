import { createContext, useContext } from "react"
import type { AppId, WallpaperId } from "./types"

export interface OsContextValue {
  openApp: (appId: AppId, payload?: unknown) => void
  closeWindow: (id: number) => void
  wallpaper: WallpaperId
  setWallpaper: (id: WallpaperId) => void
  isMobile: boolean
}

export const OsContext = createContext<OsContextValue | null>(null)

export function useOs(): OsContextValue {
  const ctx = useContext(OsContext)
  if (!ctx) throw new Error("useOs must be used inside the OS desktop")
  return ctx
}
