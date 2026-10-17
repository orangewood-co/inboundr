import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A wrapping row of chips clipped to its first line, ending in a "+N More" chip
 * that reveals the rest. The first line is measured rather than counted because
 * chip widths vary with filename length and panel width.
 */
export function CollapsibleChipRow<T>({
  items,
  getKey,
  renderItem,
  className,
}: {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  className?: string
}) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [fit, setFit] = useState({ count: items.length, height: 0, reserve: 0 })

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const chips = Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-chip]"))
    if (chips.length === 0) return

    const gap = parseFloat(getComputedStyle(list).columnGap) || 0
    const reserve = gap + (toggleRef.current?.offsetWidth ?? 0)
    let used = 0
    let count = 0
    for (const chip of chips) {
      const width = used + (count > 0 ? gap : 0) + chip.offsetWidth
      const hasMore = count + 1 < chips.length
      if (count > 0 && width + (hasMore ? reserve : 0) > list.clientWidth) break
      used = width
      count++
    }

    const height = chips[0].offsetHeight
    setFit((current) =>
      current.count === count && current.height === height && current.reserve === reserve
        ? current
        : { count, height, reserve }
    )
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure])

  useLayoutEffect(() => measure(), [measure, items, expanded, fit.count])

  const hiddenCount = items.length - fit.count
  const collapsed = !expanded && hiddenCount > 0

  // The first chip may be wider than the row on its own, so it is capped to
  // leave room for the toggle; chips must truncate their content to honour it.
  const children = items.map((item, index) => (
    <div
      key={getKey(item)}
      data-chip
      className={cn("flex min-w-0 max-w-full", collapsed && index >= fit.count && "invisible")}
      style={collapsed && index === 0 ? { maxWidth: `calc(100% - ${fit.reserve}px)` } : undefined}
    >
      {renderItem(item)}
    </div>
  ))

  if (hiddenCount > 0) {
    children.splice(
      collapsed ? fit.count : children.length,
      0,
      <button
        key="__toggle"
        ref={toggleRef}
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="surface-inset inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {expanded ? (
          <>
            <ChevronUpIcon className="size-3" />
            Show Less
          </>
        ) : (
          `+${hiddenCount} More`
        )}
      </button>
    )
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        className={cn("flex flex-wrap gap-2", collapsed && "overflow-hidden")}
        style={collapsed ? { maxHeight: fit.height } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
