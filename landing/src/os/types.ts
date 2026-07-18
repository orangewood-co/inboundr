import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"

export type AppId = "about" | "reader" | "files" | "notepad" | "tetris" | "wallpaper" | "trash"

export type WallpaperId = "base" | "radial" | "aurora" | "noise"

/** Deep-link payload for the Reader app (used by the Files app). */
export interface ReaderPayload {
  kind: "press" | "blog"
  slug: string
}

export interface AppProps {
  windowId: number
  /** True when this window is the top-most, non-minimized window. */
  focused: boolean
  minimized: boolean
  payload?: unknown
}

export interface OsApp {
  id: AppId
  name: string
  tagline: string
  icon: LucideIcon
  defaultSize: { w: number; h: number }
  component: ComponentType<AppProps>
}
