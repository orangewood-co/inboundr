import { useEffect, useRef, useState } from "react"
import { AnimatePresence } from "motion/react"
import { Volume2, Wifi } from "lucide-react"
import { APPS } from "./apps/registry"
import type { AppId } from "./types"
import type { OsWindowState } from "./useWindowManager"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"
import StartMenu from "./StartMenu"
import QuickSettings from "./QuickSettings"

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-end px-2">
      <span className="font-mono text-[11.5px] leading-tight text-text">
        {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="hidden font-mono text-[10px] leading-tight text-text-dim sm:block">
        {now.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" })}
      </span>
    </div>
  )
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-text opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  )
}

interface TaskbarProps {
  windows: OsWindowState[]
  focusedId: number | null
  onLaunch: (appId: AppId, payload?: unknown) => void
  onFocus: (id: number) => void
  onMinimize: (id: number) => void
  onMinimizeAll: () => void
}

export default function Taskbar({
  windows,
  focusedId,
  onLaunch,
  onFocus,
  onMinimize,
  onMinimizeAll,
}: TaskbarProps) {
  const [startOpen, setStartOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startOpen && !quickOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setStartOpen(false)
        setQuickOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStartOpen(false)
        setQuickOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [startOpen, quickOpen])

  const onAppClick = (appId: AppId) => {
    const win = windows.find((w) => w.appId === appId)
    if (!win) {
      onLaunch(appId)
    } else if (win.id === focusedId && !win.minimized) {
      onMinimize(win.id)
    } else {
      onFocus(win.id)
    }
  }

  return (
    <div ref={rootRef} className="absolute inset-x-0 bottom-0 z-[9000]">
      <AnimatePresence>
        {startOpen && (
          <StartMenu
            onClose={() => setStartOpen(false)}
            onLaunch={(appId, payload) => onLaunch(appId, payload)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {quickOpen && <QuickSettings onClose={() => setQuickOpen(false)} />}
      </AnimatePresence>

      {/* Bar */}
      <div
        className="os-acrylic flex items-stretch border-t border-white/[0.06]"
        style={{ height: OS_TASKBAR_HEIGHT }}
      >
        {/* Left spacer balances the tray so the icon cluster is truly centered. */}
        <div className="hidden flex-1 sm:block" />

        {/* Centered icon cluster */}
        <div className="flex flex-1 items-center justify-center gap-0.5 overflow-x-auto px-1 sm:flex-none sm:overflow-visible">
          {/* Start */}
          <button
            type="button"
            onClick={() => {
              setQuickOpen(false)
              setStartOpen((open) => !open)
            }}
            aria-expanded={startOpen}
            aria-label="Start"
            className={`group relative flex size-10 shrink-0 items-center justify-center rounded-md transition-all duration-150 ${
              startOpen ? "bg-white/[0.12]" : "hover:bg-white/[0.08]"
            } active:scale-90`}
          >
            <img src="/mark.png" alt="" className="size-6 object-contain" draggable={false} />
            <Tooltip label="Start" />
          </button>

          {APPS.map((app) => {
            const win = windows.find((w) => w.appId === app.id)
            const isFocused = !!win && win.id === focusedId && !win.minimized
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => onAppClick(app.id)}
                aria-label={app.name}
                className={`group relative flex size-10 shrink-0 items-center justify-center rounded-md transition-all duration-150 ${
                  isFocused ? "bg-white/[0.12]" : "hover:bg-white/[0.08]"
                } active:scale-90`}
              >
                <app.icon
                  className={`size-[22px] transition-colors duration-150 ${
                    win ? "text-text" : "text-text-muted group-hover:text-text"
                  }`}
                  strokeWidth={1.5}
                />
                {/* Running indicator */}
                <span
                  className={`absolute bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full transition-all duration-200 ${
                    win
                      ? isFocused
                        ? "w-4 bg-green-bright"
                        : "w-1.5 bg-text-dim"
                      : "w-0 bg-transparent"
                  }`}
                />
                <Tooltip label={app.name} />
              </button>
            )
          })}
        </div>

        {/* System tray */}
        <div className="flex flex-1 items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setStartOpen(false)
              setQuickOpen((open) => !open)
            }}
            aria-expanded={quickOpen}
            aria-label="Quick settings"
            className={`group relative mr-1 flex h-10 items-center gap-1.5 rounded-md px-2.5 transition-colors duration-150 ${
              quickOpen ? "bg-white/[0.12]" : "hover:bg-white/[0.08]"
            }`}
          >
            <Wifi className="size-4 text-text-muted" strokeWidth={1.75} />
            <Volume2 className="size-4 text-text-muted" strokeWidth={1.75} />
            <Tooltip label="Quick settings" />
          </button>

          <Clock />

          {/* Show desktop sliver */}
          <button
            type="button"
            onClick={onMinimizeAll}
            aria-label="Show desktop"
            title="Show desktop"
            className="ml-1 h-full w-2 border-l border-white/[0.08] transition-colors duration-150 hover:bg-white/[0.08]"
          />
        </div>
      </div>
    </div>
  )
}
