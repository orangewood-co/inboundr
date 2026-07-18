import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ExternalLink, Folder, Info, type LucideIcon } from "lucide-react"
import { APPS } from "./apps/registry"
import type { AppId } from "./types"
import { OS_TASKBAR_HEIGHT } from "./useWindowManager"
import type { ContextMenuItem } from "./ContextMenu"
import { useOs } from "./context"

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
}

export default function DesktopIcons({
  onLaunch,
  onDesktopMenu,
  onIconMenu,
  refreshKey,
}: DesktopIconsProps) {
  const { isMobile, animations } = useOs()
  const systemReduceMotion = useReducedMotion()
  const reduceMotion = systemReduceMotion || !animations
  const rootRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef(new Map<string, HTMLButtonElement>())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const marqueeState = useRef<{ pointerId: number; x0: number; y0: number } | null>(null)

  const icons: DesktopEntry[] = [
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
      appId: "explorer",
      payload: { location: "memes" },
    },
  ]

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
      <div className="pointer-events-none absolute left-2 top-2 grid grid-flow-col grid-rows-[repeat(auto-fill,92px)] gap-1 sm:left-4 sm:top-4">
        {icons.map((entry, i) => {
          const isSelected = selected.has(entry.id)
          const launch = () => onLaunch(entry.appId, entry.payload)
          return (
            <motion.button
              key={`${refreshKey}-${entry.id}`}
              ref={(el) => {
                if (el) iconRefs.current.set(entry.id, el)
                else iconRefs.current.delete(entry.id)
              }}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (isMobile) {
                  launch()
                } else {
                  setSelected(new Set([entry.id]))
                }
              }}
              onDoubleClick={launch}
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
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1], delay: 0.15 + i * 0.045 }}
              className={`pointer-events-auto flex h-[88px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-md border transition-colors duration-150 ${
                isSelected
                  ? "border-green-bright/40 bg-green-bright/15"
                  : "border-transparent hover:border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              <entry.icon
                className={`size-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
                  entry.isFolder ? "fill-green/40 text-green-bright" : "text-text"
                }`}
                strokeWidth={1.25}
              />
              <span className="max-w-full truncate px-1 text-[11px] font-medium text-text [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
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
