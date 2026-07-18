import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"

export type AppId =
  | "about"
  | "reader"
  | "explorer"
  | "notepad"
  | "tetris"
  | "settings"
  | "videos"
  | "photos"
  | "trash"
  | "terminal"

/** Deep-link payload for the Reader app (used by Explorer and the Start menu). */
export interface ReaderPayload {
  kind: "press" | "blog"
  slug: string
}

/** Deep-link payload for the Settings app. */
export interface SettingsPayload {
  page: "system" | "personalization" | "about"
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
  minSize: { w: number; h: number }
  component: ComponentType<AppProps>
  /** Apps hidden from the desktop grid (still in Start / taskbar). */
  desktopHidden?: boolean
}
