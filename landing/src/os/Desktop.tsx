import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import { Image, Info, LayoutGrid, Monitor, RefreshCw, StickyNote } from "lucide-react"
import { OsContext, type OsContextValue, type OsToast } from "./context"
import type { AppId } from "./types"
import { DEFAULT_WALLPAPER, isWallpaperId } from "./wallpapers"
import { useWindowManager } from "./useWindowManager"
import OsWindow from "./OsWindow"
import Taskbar from "./Taskbar"
import DesktopIcons from "./DesktopIcons"
import WallpaperLayer from "./WallpaperLayer"
import BootScreen from "./BootScreen"
import LockScreen from "./LockScreen"
import BsodScreen from "./BsodScreen"
import Toasts from "./Toasts"
import ContextMenu, { type ContextMenuItem, type ContextMenuState } from "./ContextMenu"
import { clearIconPositions } from "./iconLayout"
import "./os.css"

type Phase = "boot" | "lock" | "desktop" | "bsod"

const WALLPAPER_KEY = "inboundr-os-wallpaper"
const ANIMATIONS_KEY = "inboundr-os-animations"
const NOTIFICATIONS_KEY = "inboundr-os-notifications"
const TOAST_DURATION = 7000

/** Ambient toasts after landing on the desktop: the OS quietly sells the product. */
const AMBIENT_TOASTS: Array<{ delay: number; title: string; message: string }> = [
  {
    delay: 25_000,
    title: "Lead received",
    message: "\u201CInterested in bulk pricing.\u201D Inboundr already replied.",
  },
  {
    delay: 90_000,
    title: "Storage almost full",
    message: "D:\\Leads is at 98%. You should really follow up.",
  },
  {
    delay: 180_000,
    title: "Update available",
    message: "InboundrOS 26H2 \u2192 26H3. Adds nothing. Ships anyway.",
  },
]

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

function loadNotifications(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_KEY) !== "off"
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
  const [sortKey, setSortKey] = useState(0)
  const [toasts, setToasts] = useState<OsToast[]>([])
  const [notificationsEnabled, setNotificationsState] = useState<boolean>(loadNotifications)
  const toastId = useRef(0)
  const notificationsRef = useRef(notificationsEnabled)
  notificationsRef.current = notificationsEnabled

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

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setNotificationsState(enabled)
    // Update immediately so a notify() in the same tick sees the new value.
    notificationsRef.current = enabled
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, enabled ? "on" : "off")
    } catch {
      // Non-fatal.
    }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (title: string, message?: string) => {
      if (!notificationsRef.current) return
      const id = ++toastId.current
      setToasts((prev) => [...prev.slice(-2), { id, title, message }])
      window.setTimeout(() => dismissToast(id), TOAST_DURATION)
    },
    [dismissToast],
  )

  const { open, reset } = wm

  const sleep = useCallback(() => setPhase("lock"), [])
  const restart = useCallback(() => {
    reset()
    setToasts([])
    setPhase("boot")
  }, [reset])
  const shutdown = useCallback(() => navigate("/"), [navigate])
  const crash = useCallback(() => {
    setMenu(null)
    setToasts([])
    setPhase("bsod")
  }, [])

  // Ambient notifications: fire once per desktop session, staggered.
  useEffect(() => {
    if (phase !== "desktop") return
    const timers = AMBIENT_TOASTS.map((toast) =>
      window.setTimeout(() => notify(toast.title, toast.message), toast.delay),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [phase, notify])

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
      notify,
      notificationsEnabled,
      setNotificationsEnabled,
      crash,
      isMobile,
      sleep,
      restart,
      shutdown,
    }),
    [open, wm.close, wallpaper, setWallpaper, brightness, animations, setAnimations, notify, notificationsEnabled, setNotificationsEnabled, crash, isMobile, sleep, restart, shutdown],
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
      id: "sort",
      label: "Sort icons",
      icon: LayoutGrid,
      action: () => {
        clearIconPositions()
        setSortKey((k) => k + 1)
        setRefreshKey((k) => k + 1)
      },
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
      <title>InboundrOS</title>
      <div className="fixed inset-0 overflow-hidden bg-base text-text">
        <WallpaperLayer id={wallpaper} />

        {phase === "desktop" && (
          <DesktopIcons
            onLaunch={open}
            refreshKey={refreshKey}
            sortKey={sortKey}
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

        {/* Toast notifications */}
        {phase === "desktop" && <Toasts toasts={toasts} onDismiss={dismissToast} />}

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

        {phase === "bsod" && <BsodScreen onReboot={restart} />}
      </div>
    </OsContext.Provider>
  )
}
