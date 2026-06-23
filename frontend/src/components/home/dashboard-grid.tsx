import { useEffect, useState, type ReactNode } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CheckIcon, RotateCcwIcon, Settings2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useEntitlements } from "@/lib/entitlements"
import type { HomeLayoutItem } from "@/lib/home-layout"

import {
  WIDGET_SIZE_CLASS,
  isDefaultLayout,
  resolveLayout,
  type ResolvedWidget,
} from "./widget-registry"
import { SortableWidget } from "./sortable-widget"

export function DashboardGrid({
  heading,
  resolved,
  onPersist,
}: {
  heading: ReactNode
  resolved: ResolvedWidget[]
  onPersist: (items: HomeLayoutItem[]) => Promise<void>
}) {
  const { hasFeature, hasModuleAccess } = useEntitlements()
  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState<ResolvedWidget[]>(resolved)
  const [saving, setSaving] = useState(false)

  // Keep the live view in sync with the resolved layout while not editing
  // (e.g. after the backend reconciles or entitlements load).
  useEffect(() => {
    if (!editing) setWorking(resolved)
  }, [resolved, editing])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const visible = working.filter((widget) => !widget.hidden)
  const itemsToRender = editing ? working : visible
  const sortableIds = itemsToRender.map((widget) => widget.def.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setWorking((items) => {
      const oldIndex = items.findIndex((widget) => widget.def.id === active.id)
      const newIndex = items.findIndex((widget) => widget.def.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function toggleHidden(id: string) {
    setWorking((items) =>
      items.map((widget) =>
        widget.def.id === id ? { ...widget, hidden: !widget.hidden } : widget
      )
    )
  }

  function enterEdit() {
    setWorking(resolved)
    setEditing(true)
  }

  function cancel() {
    setWorking(resolved)
    setEditing(false)
  }

  function reset() {
    setWorking(resolveLayout(null, { hasFeature, hasModuleAccess }))
  }

  async function done() {
    setSaving(true)
    const items = isDefaultLayout(working, { hasFeature, hasModuleAccess })
      ? []
      : working.map((widget) => ({ id: widget.def.id, hidden: widget.hidden }))
    try {
      await onPersist(items)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        {heading}
        {editing ? (
          <div className="flex shrink-0 items-center gap-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              <RotateCcwIcon className="mr-1 size-3.5" />
              Reset to Default
            </Button>
            <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
              <XIcon className="mr-1 size-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={() => void done()} disabled={saving}>
              {saving ? <Spinner className="mr-1 size-3.5" /> : <CheckIcon className="mr-1 size-3.5" />}
              Done
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={enterEdit}
            className="shrink-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          >
            <Settings2Icon className="mr-1.5 size-4" />
            Customize
          </Button>
        )}
      </div>

      {editing ? (
        <p className="-mt-2 text-xs text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none">
          Drag cards to reorder. Toggle a card to show or hide it. Changes save when you click Done.
        </p>
      ) : null}

      {itemsToRender.length === 0 ? (
        <EmptyDashboard onCustomize={enterEdit} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {itemsToRender.map((widget, index) => {
                const Widget = widget.def.Component
                return (
                  <SortableWidget
                    key={widget.def.id}
                    id={widget.def.id}
                    index={index}
                    sizeClass={WIDGET_SIZE_CLASS[widget.def.size]}
                    editing={editing}
                    hidden={widget.hidden}
                    onToggleHidden={toggleHidden}
                  >
                    <Widget />
                  </SortableWidget>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function EmptyDashboard({ onCustomize }: { onCustomize: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted ring-1 ring-border/60">
        <SlidersHorizontalIcon className="size-5 text-muted-foreground" />
      </span>
      <div>
        <p className="text-sm font-medium">Your dashboard is empty</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          You&apos;ve hidden every widget. Turn some back on to bring your dashboard back.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onCustomize}>
        <Settings2Icon className="mr-1.5 size-4" />
        Customize
      </Button>
    </div>
  )
}
