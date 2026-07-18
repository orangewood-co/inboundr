import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Copy, Minus, Square, X } from "lucide-react"
import type { OsWindowState } from "./useWindowManager"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"
import { getApp } from "./apps/registry"
import { useOs } from "./context"

interface OsWindowProps {
  win: OsWindowState
  focused: boolean
  mobile: boolean
  onClose: () => void
  onFocus: () => void
  onMinimize: () => void
  onToggleMaximize: () => void
  onSetMaximized: (maximized: boolean) => void
  onMove: (x: number, y: number) => void
  onResize: (x: number, y: number, w: number, h: number) => void
}

const EASE = [0.25, 1, 0.5, 1] as const

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

const RESIZE_HANDLES: Array<{ dir: ResizeDir; className: string; cursor: string }> = [
  { dir: "n", className: "top-0 left-2 right-2 h-1.5", cursor: "ns-resize" },
  { dir: "s", className: "bottom-0 left-2 right-2 h-1.5", cursor: "ns-resize" },
  { dir: "w", className: "left-0 top-2 bottom-2 w-1.5", cursor: "ew-resize" },
  { dir: "e", className: "right-0 top-2 bottom-2 w-1.5", cursor: "ew-resize" },
  { dir: "nw", className: "top-0 left-0 size-3", cursor: "nwse-resize" },
  { dir: "se", className: "bottom-0 right-0 size-3", cursor: "nwse-resize" },
  { dir: "ne", className: "top-0 right-0 size-3", cursor: "nesw-resize" },
  { dir: "sw", className: "bottom-0 left-0 size-3", cursor: "nesw-resize" },
]

function CaptionButton({
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
      onDoubleClick={(e) => e.stopPropagation()}
      className={`flex h-full w-11 items-center justify-center text-text-muted transition-colors duration-150 ${
        close ? "hover:bg-[#c42b1c] hover:text-white" : "hover:bg-white/10 hover:text-text"
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
  onSetMaximized,
  onMove,
  onResize,
}: OsWindowProps) {
  const app = getApp(win.appId)
  const systemReduceMotion = useReducedMotion()
  const { animations } = useOs()
  const reduceMotion = systemReduceMotion || !animations
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseX: number
    baseY: number
    x: number
    y: number
    /** Set when the drag begins on a maximized window and hasn't restored yet. */
    pendingRestore: boolean
    moved: boolean
  } | null>(null)
  const resize = useRef<{
    pointerId: number
    dir: ResizeDir
    startX: number
    startY: number
    rect: { x: number; y: number; w: number; h: number }
    next: { x: number; y: number; w: number; h: number }
  } | null>(null)

  const fullscreen = mobile || win.maximized

  /* ---------------------------------- drag ---------------------------------- */

  const onTitlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mobile) return
    if (e.button !== 0 && e.pointerType === "mouse") return
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: win.x,
      baseY: win.y,
      x: win.x,
      y: win.y,
      pendingRestore: win.maximized,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onTitlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId || !frameRef.current) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    d.moved = true

    // Dragging a maximized window tears it off the top, Win11-style: restore
    // it centered under the cursor and continue the drag from there.
    if (d.pendingRestore) {
      d.pendingRestore = false
      d.baseX = Math.round(e.clientX - win.w / 2)
      d.baseY = Math.max(0, e.clientY - 20)
      onSetMaximized(false)
      onMove(d.baseX, d.baseY)
    }

    const maxX = window.innerWidth - 120
    const maxY = window.innerHeight - OS_TASKBAR_HEIGHT - 40
    d.x = Math.min(Math.max(d.baseX + dx, 120 - win.w), maxX)
    d.y = Math.min(Math.max(d.baseY + dy, 0), maxY)
    // Direct DOM write during the drag; state is committed once on release.
    frameRef.current.style.left = `${d.x}px`
    frameRef.current.style.top = `${d.y}px`
  }

  const onTitlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    // Snap: releasing at the top edge maximizes.
    if (e.clientY <= 6) {
      onMove(d.x, Math.max(d.y, 0))
      onSetMaximized(true)
      return
    }
    onMove(d.x, d.y)
  }

  /* --------------------------------- resize --------------------------------- */

  const onResizePointerDown = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) return
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.stopPropagation()
    onFocus()
    resize.current = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      rect: { x: win.x, y: win.y, w: win.w, h: win.h },
      next: { x: win.x, y: win.y, w: win.w, h: win.h },
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resize.current
    if (!r || r.pointerId !== e.pointerId || !frameRef.current) return
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    let { x, y, w, h } = r.rect

    if (r.dir.includes("e")) w = r.rect.w + dx
    if (r.dir.includes("s")) h = r.rect.h + dy
    if (r.dir.includes("w")) {
      w = r.rect.w - dx
      x = r.rect.x + dx
    }
    if (r.dir.includes("n")) {
      h = r.rect.h - dy
      y = r.rect.y + dy
    }

    // Enforce minimums; when resizing from the left/top, pin the far edge.
    if (w < win.minW) {
      if (r.dir.includes("w")) x = r.rect.x + r.rect.w - win.minW
      w = win.minW
    }
    if (h < win.minH) {
      if (r.dir.includes("n")) y = r.rect.y + r.rect.h - win.minH
      h = win.minH
    }
    if (y < 0) {
      h += y
      y = 0
    }

    r.next = { x, y, w, h }
    const style = frameRef.current.style
    style.left = `${x}px`
    style.top = `${y}px`
    style.width = `${w}px`
    style.height = `${h}px`
  }

  const onResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resize.current
    if (!r || r.pointerId !== e.pointerId) return
    resize.current = null
    onResize(r.next.x, r.next.y, r.next.w, r.next.h)
  }

  /* --------------------------------- render --------------------------------- */

  const AppComponent = app.component

  const frameStyle: CSSProperties = fullscreen
    ? { inset: 0, bottom: OS_TASKBAR_HEIGHT, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  return (
    <motion.div
      ref={frameRef}
      role="dialog"
      aria-label={app.name}
      aria-hidden={win.minimized}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 20 }}
      animate={
        win.minimized
          ? reduceMotion
            ? { opacity: 0, transitionEnd: { visibility: "hidden" } }
            : { opacity: 0, scale: 0.86, y: 56, transitionEnd: { visibility: "hidden" } }
          : reduceMotion
            ? { opacity: 1, visibility: "visible" }
            : { opacity: 1, scale: 1, y: 0, visibility: "visible" }
      }
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 20 }}
      transition={{ duration: win.minimized ? 0.24 : 0.28, ease: EASE }}
      onPointerDown={onFocus}
      style={{ ...frameStyle, transformOrigin: "50% 90%" }}
      className={`absolute flex flex-col overflow-hidden border ${
        fullscreen ? "rounded-none" : "rounded-lg"
      } ${
        focused
          ? `border-white/15 ${fullscreen ? "" : "os-window-shadow-focused"}`
          : `border-white/[0.07] ${fullscreen ? "" : "os-window-shadow"}`
      } ${win.minimized ? "pointer-events-none" : "pointer-events-auto"} bg-base`}
    >
      {/* Title bar */}
      <div
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
        onDoubleClick={() => !mobile && onToggleMaximize()}
        className={`os-mica flex h-10 shrink-0 select-none items-center justify-between border-b border-white/[0.06] pl-3.5 ${
          fullscreen ? "" : "cursor-default"
        }`}
        style={{ touchAction: "none" }}
      >
        <div className={`flex min-w-0 items-center gap-2.5 ${focused ? "text-text" : "text-text-dim"}`}>
          <app.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="truncate text-[12.5px] font-medium">{app.name}</span>
        </div>
        <div className="flex h-full items-center">
          <CaptionButton label="Minimize" onClick={onMinimize}>
            <Minus className="size-4" strokeWidth={1.5} />
          </CaptionButton>
          {!mobile && (
            <CaptionButton label={win.maximized ? "Restore down" : "Maximize"} onClick={onToggleMaximize}>
              {win.maximized ? (
                <Copy className="size-3.5" strokeWidth={1.5} />
              ) : (
                <Square className="size-3.5" strokeWidth={1.5} />
              )}
            </CaptionButton>
          )}
          <CaptionButton label="Close" onClick={onClose} close>
            <X className="size-4" strokeWidth={1.5} />
          </CaptionButton>
        </div>
      </div>

      {/* App content */}
      <div
        className={`min-h-0 flex-1 overflow-hidden transition-opacity duration-200 ${
          focused ? "" : "opacity-90"
        }`}
      >
        <AppComponent windowId={win.id} focused={focused} minimized={win.minimized} payload={win.payload} />
      </div>

      {/* Resize handles */}
      {!fullscreen &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle.dir}
            onPointerDown={onResizePointerDown(handle.dir)}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            className={`absolute z-10 ${handle.className}`}
            style={{ cursor: handle.cursor, touchAction: "none" }}
          />
        ))}
    </motion.div>
  )
}
