import type { CSSProperties, ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { EyeIcon, EyeOffIcon, GripVerticalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function SortableWidget({
  id,
  index,
  sizeClass,
  editing,
  hidden,
  onToggleHidden,
  children,
}: {
  id: string
  index: number
  sizeClass: string
  editing: boolean
  hidden: boolean
  onToggleHidden: (id: string) => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    animationDelay: `${80 + index * 55}ms`,
    animationFillMode: "backwards",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        sizeClass,
        "relative animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none",
        isDragging && "z-20"
      )}
    >
      {editing ? (
        <>
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab rounded-2xl outline-dashed outline-2 outline-offset-2 outline-border transition-[opacity,filter,box-shadow] duration-150 ease-out active:cursor-grabbing focus-visible:outline-ring motion-reduce:transition-none",
              hidden && "opacity-45 grayscale",
              isDragging && "opacity-90 shadow-lg outline-ring"
            )}
          >
            <div className="pointer-events-none select-none" aria-hidden>
              {children}
            </div>
          </div>

          <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center justify-center rounded-lg border bg-background/90 p-1 text-muted-foreground shadow-xs backdrop-blur-sm">
            <GripVerticalIcon className="size-3.5" />
          </span>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggleHidden(id)}
            className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-lg border bg-background/90 px-2 py-1 text-xs font-medium shadow-xs backdrop-blur-sm transition-colors duration-150 hover:bg-muted"
            aria-pressed={!hidden}
          >
            {hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
            {hidden ? "Hidden" : "Shown"}
          </button>
        </>
      ) : (
        children
      )}
    </div>
  )
}
