import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { LogOut } from "lucide-react"
import { APPS, getApp } from "./apps/registry"
import type { AppId } from "./types"
import type { OsWindowState } from "./useWindowManager"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"

const EASE = [0.25, 1, 0.5, 1] as const

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="hidden flex-col items-end sm:flex">
      <span className="font-mono text-[12px] leading-tight text-text">
        {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="font-mono text-[10px] leading-tight text-text-dim">
        {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
    </div>
  )
}

interface TaskbarProps {
  windows: OsWindowState[]
  focusedId: number | null
  onLaunch: (appId: AppId) => void
  onFocus: (id: number) => void
  onMinimize: (id: number) => void
}

export default function Taskbar({ windows, focusedId, onLaunch, onFocus, onMinimize }: TaskbarProps) {
  const [launcherOpen, setLauncherOpen] = useState(false)
  const launcherRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!launcherOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setLauncherOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLauncherOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [launcherOpen])

  return (
    <div ref={launcherRef} className="absolute inset-x-0 bottom-0 z-[9000]">
      {/* Launcher menu */}
      <AnimatePresence>
        {launcherOpen && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="absolute bottom-full left-2 mb-2 w-72 border border-border bg-surface"
            role="menu"
            aria-label="All apps"
          >
            <p className="border-b border-border px-4 py-3 label-sm text-text-dim">All apps</p>
            <div className="py-1">
              {APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onLaunch(app.id)
                    setLauncherOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 hover:bg-surface-raised"
                >
                  <app.icon className="size-4 text-green-bright" strokeWidth={1.5} />
                  <span className="flex-1 text-[13px] font-medium">{app.name}</span>
                  <span className="font-mono text-[10px] text-text-dim">{app.tagline}</span>
                </button>
              ))}
            </div>
            <Link
              to="/"
              className="flex items-center gap-3 border-t border-border px-4 py-3 text-[13px] font-medium text-text-muted transition-colors duration-200 hover:bg-surface-raised hover:text-text"
            >
              <LogOut className="size-4" strokeWidth={1.5} />
              Back to the website
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bar */}
      <div
        className="flex items-center gap-2 border-t border-border bg-base/90 px-2 backdrop-blur-sm"
        style={{ height: OS_TASKBAR_HEIGHT }}
      >
        <button
          type="button"
          onClick={() => setLauncherOpen((open) => !open)}
          aria-expanded={launcherOpen}
          aria-label="Open the app launcher"
          className={`flex h-9 items-center gap-2.5 px-3 transition-colors duration-200 ${
            launcherOpen ? "bg-surface-raised" : "hover:bg-surface"
          }`}
        >
          <img src="/mark.png" alt="" className="size-5 object-contain" />
          <span className="label-sm">Start</span>
        </button>

        <div className="h-6 w-px bg-border" />

        {/* Running apps */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {windows.map((win) => {
            const app = getApp(win.appId)
            const isFocused = win.id === focusedId && !win.minimized
            return (
              <button
                key={win.id}
                type="button"
                onClick={() => (isFocused ? onMinimize(win.id) : onFocus(win.id))}
                title={app.name}
                className={`relative flex h-9 shrink-0 items-center gap-2 px-3 transition-colors duration-200 ${
                  isFocused ? "bg-surface-raised" : "hover:bg-surface"
                } ${win.minimized ? "opacity-60" : ""}`}
              >
                <app.icon className="size-4" strokeWidth={1.5} />
                <span className="hidden text-[12px] font-medium md:inline">{app.name}</span>
                <span
                  className={`absolute inset-x-3 bottom-0 h-px ${
                    isFocused ? "bg-green-bright" : "bg-text-dim"
                  }`}
                />
              </button>
            )
          })}
        </div>

        <Clock />

        <Link
          to="/"
          title="Back to the website"
          aria-label="Back to the website"
          className="flex size-9 items-center justify-center text-text-dim transition-colors duration-200 hover:bg-surface hover:text-text"
        >
          <LogOut className="size-4" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  )
}
