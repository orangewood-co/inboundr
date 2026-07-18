import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Minus, Square, X } from "lucide-react"
import type { OsWindowState } from "./useWindowManager"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"
import { getApp } from "./apps/registry"

interface OsWindowProps {
  win: OsWindowState
  focused: boolean
  mobile: boolean
  onClose: () => void
  onFocus: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
  onMove: (x: number, y: number) => void
}

const EASE = [0.25, 1, 0.5, 1] as const

function ControlButton({
  label,
  onClick,
  children,
  close = false,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  close?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`flex size-7 items-center justify-center text-text-dim transition-colors duration-200 ${
        close ? "hover:bg-[#5c1f1f] hover:text-text" : "hover:bg-surface hover:text-text"
      }`}
    >
      {children}
    </button>
  )
}

export default function OsWindow({
  win,
  focused,
  mobile,
  onClose,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onMove,
}: OsWindowProps) {
  const app = getApp(win.appId)
  const reduceMotion = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)

  const fullscreen = mobile || win.maximized

  const onTitlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) return
    if (e.button !== 0 && e.pointerType === "mouse") return
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: win.x, y: win.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onTitlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId || !frameRef.current) return
    const maxX = window.innerWidth - 120
    const maxY = window.innerHeight - OS_TASKBAR_HEIGHT - 40
    d.x = Math.min(Math.max(win.x + (e.clientX - d.startX), 120 - win.w), maxX)
    d.y = Math.min(Math.max(win.y + (e.clientY - d.startY), 0), maxY)
    // Direct DOM write during the drag; state is committed once on release.
    frameRef.current.style.left = `${d.x}px`
    frameRef.current.style.top = `${d.y}px`
  }

  const onTitlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    onMove(d.x, d.y)
  }

  const AppComponent = app.component

  return (
    <motion.div
      ref={frameRef}
      role="dialog"
      aria-label={app.name}
      aria-hidden={win.minimized}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 }}
      animate={
        win.minimized
          ? reduceMotion
            ? { opacity: 0, transitionEnd: { visibility: "hidden" } }
            : { opacity: 0, scale: 0.94, y: 24, transitionEnd: { visibility: "hidden" } }
          : reduceMotion
            ? { opacity: 1, visibility: "visible" }
            : { opacity: 1, scale: 1, y: 0, visibility: "visible" }
      }
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 }}
      transition={{ duration: 0.22, ease: EASE }}
      onPointerDown={onFocus}
      className={`absolute flex flex-col overflow-hidden border bg-surface ${
        focused ? "border-white/15" : "border-border"
      } ${win.minimized ? "pointer-events-none" : "pointer-events-auto"}`}
      style={
        fullscreen
          ? { inset: 0, bottom: OS_TASKBAR_HEIGHT, zIndex: win.z }
          : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }
      }
    >
      {/* Title bar */}
      <div
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
        onDoubleClick={() => !mobile && onToggleMaximize()}
        className={`flex h-9 shrink-0 select-none items-center justify-between border-b border-border bg-surface-raised pl-3 ${
          fullscreen ? "" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ touchAction: "none" }}
      >
        <div className={`flex items-center gap-2.5 ${focused ? "text-text" : "text-text-dim"}`}>
          <app.icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          <span className="label-sm">{app.name}</span>
        </div>
        <div className="flex items-center">
          <ControlButton label="Minimize" onClick={onMinimize}>
            <Minus className="size-3.5" strokeWidth={1.75} />
          </ControlButton>
          {!mobile && (
            <ControlButton label={win.maximized ? "Restore" : "Maximize"} onClick={onToggleMaximize}>
              <Square className="size-3" strokeWidth={1.75} />
            </ControlButton>
          )}
          <ControlButton label="Close" onClick={onClose} close>
            <X className="size-3.5" strokeWidth={1.75} />
          </ControlButton>
        </div>
      </div>

      {/* App content */}
      <div className={`min-h-0 flex-1 overflow-hidden transition-opacity duration-200 ${focused ? "" : "opacity-80"}`}>
        <AppComponent windowId={win.id} focused={focused} minimized={win.minimized} payload={win.payload} />
      </div>
    </motion.div>
  )
}
