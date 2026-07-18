import { BookOpen, Film, FolderClosed, Gamepad2, Image, Info, Settings, StickyNote, Trash2 } from "lucide-react"
import type { AppId, OsApp } from "../types"
import AboutApp from "./About"
import ReaderApp from "./Reader"
import ExplorerApp from "./Explorer"
import NotepadApp from "./Notepad"
import TetrisApp from "./Tetris"
import SettingsApp from "./Settings"
import MediaPlayerApp from "./MediaPlayer"
import PhotosApp from "./Photos"
import TrashApp from "./Trash"

export const APPS: OsApp[] = [
  {
    id: "explorer",
    name: "File Explorer",
    tagline: "This PC & documents",
    icon: FolderClosed,
    defaultSize: { w: 720, h: 500 },
    minSize: { w: 420, h: 320 },
    component: ExplorerApp,
  },
  {
    id: "about",
    name: "About Inboundr",
    tagline: "Who we are",
    icon: Info,
    defaultSize: { w: 560, h: 620 },
    minSize: { w: 360, h: 320 },
    component: AboutApp,
  },
  {
    id: "reader",
    name: "Reader",
    tagline: "Press & blog",
    icon: BookOpen,
    defaultSize: { w: 640, h: 560 },
    minSize: { w: 380, h: 320 },
    component: ReaderApp,
  },
  {
    id: "videos",
    name: "Videos",
    tagline: "Watch the good stuff",
    icon: Film,
    defaultSize: { w: 760, h: 480 },
    minSize: { w: 420, h: 340 },
    component: MediaPlayerApp,
  },
  {
    id: "photos",
    name: "Photos",
    tagline: "The memes folder",
    icon: Image,
    defaultSize: { w: 640, h: 520 },
    minSize: { w: 360, h: 300 },
    component: PhotosApp,
    desktopHidden: true,
  },
  {
    id: "notepad",
    name: "Notepad",
    tagline: "Scratch space",
    icon: StickyNote,
    defaultSize: { w: 500, h: 420 },
    minSize: { w: 320, h: 260 },
    component: NotepadApp,
  },
  {
    id: "tetris",
    name: "Tetris",
    tagline: "You've earned a break",
    icon: Gamepad2,
    defaultSize: { w: 420, h: 640 },
    minSize: { w: 300, h: 420 },
    component: TetrisApp,
  },
  {
    id: "settings",
    name: "Settings",
    tagline: "Make it yours",
    icon: Settings,
    defaultSize: { w: 720, h: 540 },
    minSize: { w: 400, h: 360 },
    component: SettingsApp,
  },
  {
    id: "trash",
    name: "Recycle Bin",
    tagline: "Things we left behind",
    icon: Trash2,
    defaultSize: { w: 540, h: 400 },
    minSize: { w: 360, h: 280 },
    component: TrashApp,
  },
]

const BY_ID = new Map(APPS.map((app) => [app.id, app]))

export function getApp(id: AppId): OsApp {
  return BY_ID.get(id)!
}
