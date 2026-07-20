import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ExternalLink, Folder, Info, type LucideIcon } from "lucide-react"
import { APPS } from "./apps/registry"
import type { AppId } from "./types"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"
import type { ContextMenuItem } from "./ContextMenu"
import { useOs } from "./context"
import { wallpaperTone } from "./wallpapers"
import {
  loadIconPositions,
  saveIconPositions,
  type IconPositions,
  type IconSlot,
} from "./iconLayout"

const CELL_W = 88
const CELL_H = 94
const PAD = 12
const DRAG_THRESHOLD = 6

interface DesktopEntry {
  id: string
  name: string
  tagline: string
  icon: LucideIcon
  /** Folder shortcuts get the Explorer folder look instead of an app glyph. */
  isFolder?: boolean
  appId: AppId
  payload?: unknown
}

const ENTRIES: DesktopEntry[] = [
  ...APPS.filter((app) => !app.desktopHidden).map((app) => ({
    id: app.id as string,
    name: app.name,
    tagline: app.tagline,
    icon: app.icon,
    appId: app.id,
  })),
  {
    id: "memes-folder",
    name: "Memes",
    tagline: "Curated by engineering",
    icon: Folder,
    isFolder: true,
    appId: "explorer" as AppId,
    payload: { location: "memes" },
  },
]

interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface DesktopIconsProps {
  onLaunch: (appId: AppId, payload?: unknown) => void
  onDesktopMenu: (x: number, y: number) => void
  onIconMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  /** Bumps to replay the icon entrance stagger ("Refresh"). */
  refreshKey: number
  /** Bumps to clear the saved layout and re-grid ("Sort icons"). */
  sortKey: number
  /** Bumps to make the icons do a wave (Konami code). */
  waveKey: number
}

export default function DesktopIcons({
  onLaunch,
  onDesktopMenu,
  onIconMenu,
  refreshKey,
  sortKey,
  waveKey,
}: DesktopIconsProps) {
  const { isMobile, animations, wallpaper } = useOs()
  const onLightWallpaper = wallpaperTone(wallpaper) === "light"
  const systemReduceMotion = useReducedMotion()
  const reduceMotion = systemReduceMotion || !animations
  const rootRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef(new Map<string, HTMLButtonElement>())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const marqueeState = useRef<{ pointerId: number; x0: number; y0: number } | null>(null)

  const [positions, setPositions] = useState<IconPositions>(loadIconPositions)
  const [bounds, setBounds] = useState(() => ({
    cols: Math.max(1, Math.floor((window.innerWidth - PAD * 2) / CELL_W)),
    rows: Math.max(1, Math.floor((window.innerHeight - OS_TASKBAR_HEIGHT - PAD * 2) / CELL_H)),
  }))

  // Icon drag state (one icon at a time). The live offset lives in state and
  // is applied through left/top, because Motion owns the buttons' transform.
  const iconDrag = useRef<{
    pointerId: number
    entryId: string
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)
  const didDrag = useRef(false)
  const [dragVis, setDragVis] = useState<{ entryId: string; dx: number; dy: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<IconSlot | null>(null)

  // "Sort icons" clears the in-memory arrangement; the parent already wiped
  // localStorage. Adjust state during render when the prop changes.
  const [lastSortKey, setLastSortKey] = useState(sortKey)
  if (sortKey !== lastSortKey) {
    setLastSortKey(sortKey)
    setPositions({})
  }

  // Konami wave: briefly animate every icon, staggered left-to-right.
  const [waving, setWaving] = useState(false)
  const [lastWaveKey, setLastWaveKey] = useState(waveKey)
  if (waveKey !== lastWaveKey) {
    setLastWaveKey(waveKey)
    setWaving(true)
  }
  useLayoutEffect(() => {
    if (!waving) return
    const id = window.setTimeout(() => setWaving(false), 1600)
    return () => window.clearTimeout(id)
  }, [waving])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setBounds({
        cols: Math.max(1, Math.floor((rect.width - PAD * 2) / CELL_W)),
        rows: Math.max(1, Math.floor((rect.height - PAD * 2) / CELL_H)),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /**
   * Final slot for every entry: explicit (user-moved, clamped to the current
   * bounds) first, then defaults flowing top-to-bottom, left-to-right into
   * whatever slots remain free.
   */
  const layout = useMemo(() => {
    const result = new Map<string, IconSlot>()
    const occupied = new Set<string>()

    for (const entry of ENTRIES) {
      const explicit = positions[entry.id]
      if (!explicit) continue
      const slot = {
        col: Math.min(Math.max(explicit.col, 0), bounds.cols - 1),
        row: Math.min(Math.max(explicit.row, 0), bounds.rows - 1),
      }
      // If clamping collided with another explicit icon, fall through to auto.
      const key = `${slot.col},${slot.row}`
      if (occupied.has(key)) continue
      result.set(entry.id, slot)
      occupied.add(key)
    }

    let cursor = 0
    for (const entry of ENTRIES) {
      if (result.has(entry.id)) continue
      let slot: IconSlot
      do {
        slot = { col: Math.floor(cursor / bounds.rows), row: cursor % bounds.rows }
        cursor++
      } while (occupied.has(`${slot.col},${slot.row}`) && cursor < bounds.cols * bounds.rows + ENTRIES.length)
      result.set(entry.id, slot)
      occupied.add(`${slot.col},${slot.row}`)
    }
    return result
  }, [positions, bounds])

  const slotFromPoint = (clientX: number, clientY: number): IconSlot => {
    const rect = rootRef.current?.getBoundingClientRect()
    const x = clientX - (rect?.left ?? 0) - PAD
    const y = clientY - (rect?.top ?? 0) - PAD
    return {
      col: Math.min(Math.max(Math.round((x - CELL_W / 2) / CELL_W), 0), bounds.cols - 1),
      row: Math.min(Math.max(Math.round((y - CELL_H / 2) / CELL_H), 0), bounds.rows - 1),
    }
  }

  /* ------------------------------- icon dragging ------------------------------ */

  const onIconPointerDown = (entry: DesktopEntry) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (isMobile) return
    if (e.button !== 0 && e.pointerType === "mouse") return
    didDrag.current = false
    iconDrag.current = {
      pointerId: e.pointerId,
      entryId: entry.id,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onIconPointerMove = (entry: DesktopEntry) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = iconDrag.current
    if (!d || d.pointerId !== e.pointerId || d.entryId !== entry.id) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      d.dragging = true
      didDrag.current = true
      setSelected(new Set([entry.id]))
    }
    setDragVis({ entryId: entry.id, dx, dy })
    setDropTarget(slotFromPoint(e.clientX, e.clientY))
  }

  const onIconPointerUp = (entry: DesktopEntry) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = iconDrag.current
    if (!d || d.pointerId !== e.pointerId) return
    iconDrag.current = null
    setDropTarget(null)
    setDragVis(null)
    if (!d.dragging) return

    const target = slotFromPoint(e.clientX, e.clientY)
    const current = layout.get(entry.id)
    if (!current || (target.col === current.col && target.row === current.row)) return

    // Swap with whoever occupies the target slot.
    let occupant: string | null = null
    for (const [id, slot] of layout) {
      if (id !== entry.id && slot.col === target.col && slot.row === target.row) {
        occupant = id
        break
      }
    }
    const next: IconPositions = { ...positions, [entry.id]: target }
    if (occupant) next[occupant] = current
    setPositions(next)
    saveIconPositions(next)
  }

  /* ------------------------------ marquee select ----------------------------- */

  const onRootPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== rootRef.current) return
    if (e.button !== 0 || isMobile) {
      if (e.button === 0) setSelected(new Set())
      return
    }
    setSelected(new Set())
    marqueeState.current = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY }
    rootRef.current.setPointerCapture(e.pointerId)
  }

  const onRootPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeState.current
    if (!m || m.pointerId !== e.pointerId) return
    const rect: Marquee = { x0: m.x0, y0: m.y0, x1: e.clientX, y1: e.clientY }
    setMarquee(rect)

    const left = Math.min(rect.x0, rect.x1)
    const right = Math.max(rect.x0, rect.x1)
    const top = Math.min(rect.y0, rect.y1)
    const bottom = Math.max(rect.y0, rect.y1)
    const next = new Set<string>()
    for (const [entryId, el] of iconRefs.current) {
      const r = el.getBoundingClientRect()
      if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) next.add(entryId)
    }
    setSelected(next)
  }

  const onRootPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeState.current
    if (!m || m.pointerId !== e.pointerId) return
    marqueeState.current = null
    setMarquee(null)
  }

  /* --------------------------------- render --------------------------------- */

  return (
    <div
      ref={rootRef}
      className="absolute inset-x-0 top-0 z-0"
      style={{ bottom: OS_TASKBAR_HEIGHT, touchAction: "none" }}
      onPointerDown={onRootPointerDown}
      onPointerMove={onRootPointerMove}
      onPointerUp={onRootPointerUp}
      onPointerCancel={onRootPointerUp}
      onContextMenu={(e) => {
        if (e.target !== rootRef.current) return
        e.preventDefault()
        onDesktopMenu(e.clientX, e.clientY)
      }}
    >
      {/* Drop slot highlight */}
      {dropTarget && (
        <div
          className="pointer-events-none absolute rounded-md border border-green-bright/40 bg-green-bright/10"
          style={{
            left: PAD + dropTarget.col * CELL_W,
            top: PAD + dropTarget.row * CELL_H,
            width: 84,
            height: 88,
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-0">
        {ENTRIES.map((entry, i) => {
          const isSelected = selected.has(entry.id)
          const slot = layout.get(entry.id)!
          const isDragging = dragVis?.entryId === entry.id
          const launch = () => onLaunch(entry.appId, entry.payload)
          return (
            <motion.button
              key={`${refreshKey}-${entry.id}`}
              ref={(el) => {
                if (el) iconRefs.current.set(entry.id, el)
                else iconRefs.current.delete(entry.id)
              }}
              type="button"
              style={{
                left: PAD + slot.col * CELL_W + (isDragging ? dragVis.dx : 0),
                top: PAD + slot.row * CELL_H + (isDragging ? dragVis.dy : 0),
                zIndex: isDragging ? 40 : undefined,
                touchAction: "none",
              }}
              onPointerDown={onIconPointerDown(entry)}
              onPointerMove={onIconPointerMove(entry)}
              onPointerUp={onIconPointerUp(entry)}
              onPointerCancel={onIconPointerUp(entry)}
              onClick={(e) => {
                e.stopPropagation()
                if (didDrag.current) {
                  didDrag.current = false
                  return
                }
                if (isMobile) {
                  launch()
                } else {
                  setSelected(new Set([entry.id]))
                }
              }}
              onDoubleClick={() => {
                if (!didDrag.current) launch()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") launch()
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelected(new Set([entry.id]))
                onIconMenu(e.clientX, e.clientY, [
                  { id: "open", label: `Open ${entry.name}`, icon: ExternalLink, action: launch },
                  { id: "about", label: entry.tagline, icon: Info, disabled: true, separatorBefore: true },
                ])
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
              animate={
                waving && !reduceMotion
                  ? { opacity: 1, y: [0, -16, 0], scale: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              transition={
                waving && !reduceMotion
                  ? { duration: 0.5, ease: "easeInOut", delay: slot.col * 0.09 + slot.row * 0.05 }
                  : { duration: 0.45, ease: [0.25, 1, 0.5, 1], delay: 0.15 + i * 0.045 }
              }
              className={`pointer-events-auto absolute flex h-[88px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-md border transition-colors duration-150 ${
                isSelected
                  ? "border-green-bright/40 bg-green-bright/15"
                  : onLightWallpaper
                    ? "border-transparent hover:border-black/10 hover:bg-black/[0.06]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              <entry.icon
                className={`size-8 ${
                  entry.isFolder
                    ? "fill-green/40 text-green-bright drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                    : onLightWallpaper
                      ? "text-neutral-800 drop-shadow-[0_1px_3px_rgba(255,255,255,0.7)]"
                      : "text-text drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                }`}
                strokeWidth={1.25}
              />
              <span
                className={`max-w-full truncate px-1 text-[11px] font-medium ${
                  onLightWallpaper
                    ? "text-neutral-800 [text-shadow:0_1px_3px_rgba(255,255,255,0.8)]"
                    : "text-text [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]"
                }`}
              >
                {entry.name}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Marquee rectangle */}
      {marquee && (
        <div
          className="pointer-events-none fixed border border-green-bright/50 bg-green-bright/10"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  )
}
