import { useLayoutEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { LucideIcon } from "lucide-react"

export interface ContextMenuItem {
  id: string
  label: string
  icon?: LucideIcon
  /** Renders a divider above this item. */
  separatorBefore?: boolean
  disabled?: boolean
  action?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export default function ContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })

  // Clamp to the viewport once we know the rendered size.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, window.innerWidth - rect.width - 8),
      y: Math.min(menu.y, window.innerHeight - rect.height - 8),
    })
  }, [menu])

  useLayoutEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12, ease: [0.25, 1, 0.5, 1] }}
      className="os-acrylic fixed z-[9200] w-60 rounded-lg border border-white/10 py-1.5 shadow-2xl"
      style={{ left: pos.x, top: pos.y, transformOrigin: "top left" }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore && <div className="mx-2 my-1.5 h-px bg-white/[0.08]" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.action?.()
            }}
            className={`mx-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-md px-2.5 py-[7px] text-left text-[12.5px] font-medium transition-colors duration-100 ${
              item.disabled
                ? "cursor-default text-text-dim"
                : "text-text hover:bg-white/[0.09]"
            }`}
          >
            {item.icon ? (
              <item.icon className="size-4 shrink-0 text-text-muted" strokeWidth={1.75} />
            ) : (
              <span className="size-4 shrink-0" />
            )}
            {item.label}
          </button>
        </div>
      ))}
    </motion.div>
  )
}
