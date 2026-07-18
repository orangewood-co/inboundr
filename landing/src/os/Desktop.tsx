import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { AuroraBackground } from "@/components/AuroraBackground"
import { OsContext, type OsContextValue } from "./context"
import type { AppId, WallpaperId } from "./types"
import { useWindowManager } from "./useWindowManager"
import OsWindow from "./OsWindow"
import Taskbar from "./Taskbar"
import DesktopIcons from "./DesktopIcons"

const WALLPAPER_KEY = "inboundr-os-wallpaper"
const WALLPAPERS: WallpaperId[] = ["base", "radial", "aurora", "noise"]

function loadWallpaper(): WallpaperId {
  try {
    const stored = localStorage.getItem(WALLPAPER_KEY)
    if (stored && WALLPAPERS.includes(stored as WallpaperId)) return stored as WallpaperId
  } catch {
    // localStorage unavailable; fall through to the default.
  }
  return "radial"
}

function WallpaperLayer({ id }: { id: WallpaperId }) {
  if (id === "aurora") {
    return (
      <AuroraBackground showRadialGradient={false} className="absolute inset-0" aria-hidden>
        <></>
      </AuroraBackground>
    )
  }
  if (id === "radial") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(47,93,80,0.35),transparent)]"
      />
    )
  }
  if (id === "noise") {
    return <div aria-hidden className="noise absolute inset-0 overflow-hidden bg-surface" />
  }
  return null
}

function BootOverlay({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const id = window.setTimeout(onDone, reduceMotion ? 400 : 1300)
    return () => window.clearTimeout(id)
  }, [onDone, reduceMotion])

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      className="absolute inset-0 z-[9500] flex flex-col items-center justify-center gap-3 bg-base"
    >
      <motion.p
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-4xl italic text-gold sm:text-5xl"
      >
        InboundrOS
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.4 }}
        className="label-sm text-text-dim"
      >
        Booting up
      </motion.p>
    </motion.div>
  )
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
  const isMobile = useIsMobile()
  const [wallpaper, setWallpaperState] = useState<WallpaperId>(loadWallpaper)
  const [booting, setBooting] = useState(true)

  const setWallpaper = (id: WallpaperId) => {
    setWallpaperState(id)
    try {
      localStorage.setItem(WALLPAPER_KEY, id)
    } catch {
      // Fine — the choice just won't survive a reload.
    }
  }

  // Greet larger screens with the About window so the desktop isn't bare.
  const { open } = wm
  useEffect(() => {
    if (booting) return
    if (window.matchMedia("(min-width: 640px)").matches) open("about")
    // Run exactly once, after boot completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting])

  const context = useMemo<OsContextValue>(
    () => ({
      openApp: (appId: AppId, payload?: unknown) => open(appId, payload),
      closeWindow: wm.close,
      wallpaper,
      setWallpaper,
      isMobile,
    }),
    [open, wm.close, wallpaper, isMobile],
  )

  return (
    <OsContext.Provider value={context}>
      <title>InboundrOS — Inboundr</title>
      <div className="fixed inset-0 overflow-hidden bg-base text-text">
        <WallpaperLayer id={wallpaper} />

        <DesktopIcons onLaunch={open} />

        {/* Windows layer must not block clicks on the desktop icons beneath it. */}
        <div className="pointer-events-none absolute inset-0">
          <AnimatePresence>
            {wm.windows.map((win) => (
              <OsWindow
                key={win.id}
                win={win}
                focused={win.id === wm.focusedId}
                mobile={isMobile}
                onClose={() => wm.close(win.id)}
                onFocus={() => wm.focus(win.id)}
                onMinimize={() => wm.minimize(win.id)}
                onToggleMaximize={() => wm.toggleMaximize(win.id)}
                onMove={(x, y) => wm.move(win.id, x, y)}
              />
            ))}
          </AnimatePresence>
        </div>

        <Taskbar
          windows={wm.windows}
          focusedId={wm.focusedId}
          onLaunch={open}
          onFocus={wm.focus}
          onMinimize={wm.minimize}
        />

        <AnimatePresence>{booting && <BootOverlay onDone={() => setBooting(false)} />}</AnimatePresence>
      </div>
    </OsContext.Provider>
  )
}
