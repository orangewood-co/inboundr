import { BookOpen, FolderOpen, Gamepad2, Image, Info, StickyNote, Trash2 } from "lucide-react"
import type { AppId, OsApp } from "../types"
import AboutApp from "./About"
import ReaderApp from "./Reader"
import FilesApp from "./Files"
import NotepadApp from "./Notepad"
import TetrisApp from "./Tetris"
import WallpaperApp from "./Wallpaper"
import TrashApp from "./Trash"

export const APPS: OsApp[] = [
  {
    id: "about",
    name: "About",
    tagline: "Who we are",
    icon: Info,
    defaultSize: { w: 560, h: 620 },
    component: AboutApp,
  },
  {
    id: "reader",
    name: "Reader",
    tagline: "Press & blog",
    icon: BookOpen,
    defaultSize: { w: 620, h: 560 },
    component: ReaderApp,
  },
  {
    id: "files",
    name: "Files",
    tagline: "Company documents",
    icon: FolderOpen,
    defaultSize: { w: 560, h: 460 },
    component: FilesApp,
  },
  {
    id: "notepad",
    name: "Notepad",
    tagline: "Scratch space",
    icon: StickyNote,
    defaultSize: { w: 480, h: 420 },
    component: NotepadApp,
  },
  {
    id: "tetris",
    name: "Tetris",
    tagline: "You've earned a break",
    icon: Gamepad2,
    defaultSize: { w: 420, h: 620 },
    component: TetrisApp,
  },
  {
    id: "wallpaper",
    name: "Wallpaper",
    tagline: "Make it yours",
    icon: Image,
    defaultSize: { w: 440, h: 440 },
    component: WallpaperApp,
  },
  {
    id: "trash",
    name: "Trash",
    tagline: "Things we left behind",
    icon: Trash2,
    defaultSize: { w: 520, h: 380 },
    component: TrashApp,
  },
]

const BY_ID = new Map(APPS.map((app) => [app.id, app]))

export function getApp(id: AppId): OsApp {
  return BY_ID.get(id)!
}
