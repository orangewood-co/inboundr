import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import { Image, Info, Monitor, RefreshCw, StickyNote } from "lucide-react"
import { OsContext, type OsContextValue } from "./context"
import type { AppId } from "./types"
import { DEFAULT_WALLPAPER, isWallpaperId } from "./wallpapers"
import { useWindowManager } from "./useWindowManager"
import OsWindow from "./OsWindow"
import Taskbar from "./Taskbar"
import DesktopIcons from "./DesktopIcons"
import WallpaperLayer from "./WallpaperLayer"
import BootScreen from "./BootScreen"
import LockScreen from "./LockScreen"
import ContextMenu, { type ContextMenuItem, type ContextMenuState } from "./ContextMenu"
import "./os.css"

type Phase = "boot" | "lock" | "desktop"

const WALLPAPER_KEY = "inboundr-os-wallpaper"
const ANIMATIONS_KEY = "inboundr-os-animations"

function loadWallpaper(): string {
  try {
    const stored = localStorage.getItem(WALLPAPER_KEY)
    if (stored && isWallpaperId(stored)) return stored
  } catch {
    // localStorage unavailable; fall through to the default.
  }
  return DEFAULT_WALLPAPER
}

function loadAnimations(): boolean {
  try {
    return localStorage.getItem(ANIMATIONS_KEY) !== "off"
  } catch {
    return true
  }
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  )
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)")
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return isMobile
}

export default function Desktop() {
  const wm = useWindowManager()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState<Phase>("boot")
  const [wallpaper, setWallpaperState] = useState<string>(loadWallpaper)
  const [brightness, setBrightness] = useState(100)
  const [animations, setAnimationsState] = useState<boolean>(loadAnimations)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const setWallpaper = useCallback((id: string) => {
    setWallpaperState(id)
    try {
      localStorage.setItem(WALLPAPER_KEY, id)
    } catch {
      // Fine — the choice just won't survive a reload.
    }
  }, [])

  const setAnimations = useCallback((enabled: boolean) => {
    setAnimationsState(enabled)
    try {
      localStorage.setItem(ANIMATIONS_KEY, enabled ? "on" : "off")
    } catch {
      // Non-fatal.
    }
  }, [])

  const { open, reset } = wm

  const sleep = useCallback(() => setPhase("lock"), [])
  const restart = useCallback(() => {
    reset()
    setPhase("boot")
  }, [reset])
  const shutdown = useCallback(() => navigate("/"), [navigate])

  const context = useMemo<OsContextValue>(
    () => ({
      openApp: (appId: AppId, payload?: unknown) => open(appId, payload),
      closeWindow: wm.close,
      wallpaper,
      setWallpaper,
      brightness,
      setBrightness,
      animations,
      setAnimations,
      isMobile,
      sleep,
      restart,
      shutdown,
    }),
    [open, wm.close, wallpaper, setWallpaper, brightness, animations, setAnimations, isMobile, sleep, restart, shutdown],
  )

  const openContextMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    setMenu({ x, y, items })
  }, [])

  const desktopMenuItems: ContextMenuItem[] = [
    {
      id: "refresh",
      label: "Refresh",
      icon: RefreshCw,
      action: () => setRefreshKey((k) => k + 1),
    },
    {
      id: "new-note",
      label: "New note",
      icon: StickyNote,
      action: () => open("notepad"),
    },
    {
      id: "wallpaper",
      label: "Change wallpaper",
      icon: Image,
      separatorBefore: true,
      action: () => open("settings", { page: "personalization" }),
    },
    {
      id: "display",
      label: "Display settings",
      icon: Monitor,
      action: () => open("settings", { page: "system" }),
    },
    {
      id: "about",
      label: "About InboundrOS",
      icon: Info,
      separatorBefore: true,
      action: () => open("settings", { page: "about" }),
    },
  ]

  return (
    <OsContext.Provider value={context}>
      <title>InboundrOS — Inboundr</title>
      <div className="fixed inset-0 overflow-hidden bg-base text-text">
        <WallpaperLayer id={wallpaper} />

        {phase === "desktop" && (
          <DesktopIcons
            onLaunch={open}
            refreshKey={refreshKey}
            onDesktopMenu={(x, y) => openContextMenu(x, y, desktopMenuItems)}
            onIconMenu={openContextMenu}
          />
        )}

        {/* Windows layer must not block clicks on the desktop icons beneath it. */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <AnimatePresence>
            {phase === "desktop" &&
              wm.windows.map((win) => (
                <OsWindow
                  key={win.id}
                  win={win}
                  focused={win.id === wm.focusedId}
                  mobile={isMobile}
                  onClose={() => wm.close(win.id)}
                  onFocus={() => wm.focus(win.id)}
                  onMinimize={() => wm.minimize(win.id)}
                  onToggleMaximize={() => wm.toggleMaximize(win.id)}
                  onSetMaximized={(maximized) => wm.setMaximized(win.id, maximized)}
                  onMove={(x, y) => wm.move(win.id, x, y)}
                  onResize={(x, y, w, h) => wm.resize(win.id, x, y, w, h)}
                />
              ))}
          </AnimatePresence>
        </div>

        {phase === "desktop" && (
          <Taskbar
            windows={wm.windows}
            focusedId={wm.focusedId}
            onLaunch={open}
            onFocus={wm.focus}
            onMinimize={wm.minimize}
            onMinimizeAll={wm.minimizeAll}
          />
        )}

        {/* Desktop / icon context menu */}
        <AnimatePresence>
          {menu && phase === "desktop" && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
        </AnimatePresence>

        {/* Brightness dim — above the desktop, below lock and boot. */}
        {brightness < 100 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[9300] bg-black"
            style={{ opacity: ((100 - brightness) / 100) * 0.75 }}
          />
        )}

        <AnimatePresence>
          {phase === "lock" && (
            <LockScreen wallpaper={wallpaper} onUnlock={() => setPhase("desktop")} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {phase === "boot" && <BootScreen onDone={() => setPhase("lock")} />}
        </AnimatePresence>
      </div>
    </OsContext.Provider>
  )
}
