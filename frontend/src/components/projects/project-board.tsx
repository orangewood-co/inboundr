import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  AlignLeftIcon,
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  ListTreeIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ProjectEmployee, ProjectStage, ProjectTask } from "@/lib/projects"
import { cn } from "@/lib/utils"
import {
  DueDatePill,
  EmployeeStack,
  STAGE_COLOR_PALETTE,
  formatMinutes,
  stageColor,
} from "@/components/projects/board-ui"

type ItemsMap = Record<string, string[]>

export type ProjectBoardProps = {
  stages: ProjectStage[]
  tasks: ProjectTask[]
  employees: ProjectEmployee[]
  trackedByTask: Record<string, number>
  subtaskCountByTask: Record<string, number>
  onOpenTask: (taskId: string) => void
  onMoveTask: (taskId: string, stageId: string, order: number) => void
  onReorderStages: (stageIds: string[]) => void
  onRenameStage: (stageId: string, name: string) => void
  onRecolorStage: (stageId: string, color: string) => void
  onArchiveStage: (stageId: string) => void
  onQuickAddTask: (stageId: string, title: string) => void
  onAddStage: (name: string) => void
  onAddTaskAdvanced: (stageId: string) => void
}

function buildItems(stages: ProjectStage[], tasks: ProjectTask[]): ItemsMap {
  const map: ItemsMap = {}
  for (const stage of stages) map[stage._id] = []
  const sorted = [...tasks].sort((a, b) => a.order - b.order)
  for (const task of sorted) {
    if (!map[task.stageId]) map[task.stageId] = []
    map[task.stageId]!.push(task._id)
  }
  return map
}

function TaskCardContent({
  task,
  employees,
  trackedMinutes,
  subtaskCount,
  accent,
  className,
  dragging,
}: {
  task: ProjectTask
  employees: ProjectEmployee[]
  trackedMinutes: number
  subtaskCount: number
  accent: string
  className?: string
  dragging?: boolean
}) {
  return (
    <div
      className={cn(
        "group/card relative cursor-pointer rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        dragging && "rotate-2 shadow-xl",
        className
      )}
    >
      <span
        className="absolute inset-y-2 left-0 w-1 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="pl-2">
        <p className="text-sm leading-snug font-medium">{task.title}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <EmployeeStack employees={employees} ids={task.assigneeIds} limit={3} emptyLabel={null} />
          <div className="flex items-center gap-1.5">
            {task.description && (
              <AlignLeftIcon className="size-3.5 text-muted-foreground" />
            )}
            {subtaskCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <ListTreeIcon className="size-3.5" />
                {subtaskCount}
              </span>
            )}
            {trackedMinutes > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <ClockIcon className="size-3" />
                {formatMinutes(trackedMinutes)}
              </span>
            )}
            <DueDatePill due={task.dueDate} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableTaskCard({
  task,
  employees,
  trackedMinutes,
  subtaskCount,
  accent,
  onOpen,
}: {
  task: ProjectTask
  employees: ProjectEmployee[]
  trackedMinutes: number
  subtaskCount: number
  accent: string
  onOpen: (taskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { type: "task" },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[4.5rem] rounded-xl border-2 border-dashed border-border bg-muted/40"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task._id)}
    >
      <TaskCardContent
        task={task}
        employees={employees}
        trackedMinutes={trackedMinutes}
        subtaskCount={subtaskCount}
        accent={accent}
      />
    </div>
  )
}

function StageColorPicker({
  color,
  onSelect,
}: {
  color: string
  onSelect: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="size-3 shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-border"
          style={{ backgroundColor: color }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Change stage color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" onPointerDown={(event) => event.stopPropagation()}>
        <div className="grid grid-cols-6 gap-2">
          {STAGE_COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="flex size-7 items-center justify-center rounded-full ring-2 ring-transparent transition hover:ring-border"
              style={{ backgroundColor: swatch }}
              onClick={() => {
                onSelect(swatch)
                setOpen(false)
              }}
              aria-label={`Set color ${swatch}`}
            >
              {swatch.toLowerCase() === color.toLowerCase() && (
                <CheckIcon className="size-3.5 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BoardColumn({
  stage,
  taskIds,
  tasksById,
  employees,
  trackedByTask,
  subtaskCountByTask,
  onOpenTask,
  onRenameStage,
  onRecolorStage,
  onArchiveStage,
  onQuickAddTask,
  onAddTaskAdvanced,
}: {
  stage: ProjectStage
  taskIds: string[]
  tasksById: Map<string, ProjectTask>
  employees: ProjectEmployee[]
  trackedByTask: Record<string, number>
  subtaskCountByTask: Record<string, number>
  onOpenTask: (taskId: string) => void
  onRenameStage: (stageId: string, name: string) => void
  onRecolorStage: (stageId: string, color: string) => void
  onArchiveStage: (stageId: string) => void
  onQuickAddTask: (stageId: string, title: string) => void
  onAddTaskAdvanced: (stageId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage._id,
    data: { type: "column" },
  })
  const accent = stageColor(stage.color)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(stage.name)
  const [adding, setAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const addRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) addRef.current?.focus()
  }, [adding])

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  function commitRename() {
    const next = nameDraft.trim()
    if (next && next !== stage.name) onRenameStage(stage._id, next)
    else setNameDraft(stage.name)
    setRenaming(false)
  }

  function commitAdd() {
    const title = draftTitle.trim()
    if (title) onQuickAddTask(stage._id, title)
    setDraftTitle("")
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex max-h-full w-80 shrink-0 flex-col overflow-hidden rounded-2xl border bg-muted/30",
        isDragging && "opacity-60"
      )}
    >
      <header
        className="flex items-center gap-2 rounded-t-2xl px-3 py-2.5"
        style={{ backgroundColor: `${accent}1a` }}
        {...attributes}
        {...listeners}
      >
        <StageColorPicker color={accent} onSelect={(value) => onRecolorStage(stage._id, value)} />
        {renaming ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename()
              if (event.key === "Escape") {
                setNameDraft(stage.name)
                setRenaming(false)
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="h-7 flex-1 bg-background"
          />
        ) : (
          <button
            type="button"
            className="flex-1 truncate text-left text-sm font-semibold"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setNameDraft(stage.name)
              setRenaming(true)
            }}
          >
            {stage.name}
          </button>
        )}
        <span className="rounded-full bg-background/70 px-1.5 text-xs font-medium text-muted-foreground">
          {taskIds.length}
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setAdding(true)}
          aria-label="Add task"
        >
          <PlusIcon className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Stage actions"
            >
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => {
                setNameDraft(stage.name)
                setRenaming(true)
              }}
            >
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddTaskAdvanced(stage._id)}>
              <PlusIcon />
              Add Task with Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onArchiveStage(stage._id)}>
              <ArchiveIcon />
              Archive Stage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto p-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((taskId) => {
            const task = tasksById.get(taskId)
            if (!task) return null
            return (
              <SortableTaskCard
                key={taskId}
                task={task}
                employees={employees}
                trackedMinutes={trackedByTask[taskId] ?? 0}
                subtaskCount={subtaskCountByTask[taskId] ?? 0}
                accent={accent}
                onOpen={onOpenTask}
              />
            )
          })}
        </SortableContext>

        {adding ? (
          <div className="rounded-xl border bg-card p-2 shadow-sm">
            <Input
              ref={addRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Task title..."
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd()
                if (event.key === "Escape") {
                  setDraftTitle("")
                  setAdding(false)
                }
              }}
              className="h-8"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={commitAdd}>
                Add Task
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setDraftTitle("")
                  setAdding(false)
                }}
                aria-label="Cancel"
              >
                <XIcon />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
          >
            <PlusIcon className="size-4" />
            Add a Task
          </button>
        )}
      </div>
    </section>
  )
}

function AddListAffordance({ onAddStage }: { onAddStage: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function commit() {
    const next = name.trim()
    if (next) onAddStage(next)
    setName("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-72 shrink-0 items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
      >
        <PlusIcon className="size-4" />
        Add Another Stage
      </button>
    )
  }

  return (
    <div className="w-72 shrink-0 rounded-2xl border bg-card p-2 shadow-sm">
      <Input
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Stage name..."
        onKeyDown={(event) => {
          if (event.key === "Enter") commit()
          if (event.key === "Escape") {
            setName("")
            setOpen(false)
          }
        }}
        className="h-8"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={commit}>
          Add Stage
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setName("")
            setOpen(false)
          }}
          aria-label="Cancel"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

export function ProjectBoard({
  stages,
  tasks,
  employees,
  trackedByTask,
  subtaskCountByTask,
  onOpenTask,
  onMoveTask,
  onReorderStages,
  onRenameStage,
  onRecolorStage,
  onArchiveStage,
  onQuickAddTask,
  onAddStage,
  onAddTaskAdvanced,
}: ProjectBoardProps) {
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task._id, task])), [tasks])
  const stagesById = useMemo(() => new Map(stages.map((stage) => [stage._id, stage])), [stages])

  const stageSignature = useMemo(
    () => stages.map((stage) => `${stage._id}:${stage.order}`).join("|"),
    [stages]
  )
  const taskSignature = useMemo(
    () => tasks.map((task) => `${task._id}:${task.stageId}:${task.order}`).join("|"),
    [tasks]
  )

  const [containers, setContainers] = useState<string[]>(() => stages.map((stage) => stage._id))
  const [items, setItems] = useState<ItemsMap>(() => buildItems(stages, tasks))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<"task" | "column" | null>(null)

  useEffect(() => {
    setContainers(stages.map((stage) => stage._id))
    setItems(buildItems(stages, tasks))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSignature, taskSignature])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function findContainer(id: string): string | undefined {
    if (containers.includes(id)) return id
    return containers.find((containerId) => items[containerId]?.includes(id))
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    setActiveType(event.active.data.current?.type === "column" ? "column" : "task")
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type !== "task") return
    const { active, over } = event
    if (!over) return
    const activeIdValue = String(active.id)
    const overId = String(over.id)
    const activeContainer = findContainer(activeIdValue)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setItems((prev) => {
      const activeItems = prev[activeContainer] ?? []
      const overItems = prev[overContainer] ?? []
      const overIndex = overItems.indexOf(overId)
      const isColumn = containers.includes(overId)
      const translatedTop = active.rect.current.translated?.top ?? 0
      const isBelow = over.rect ? translatedTop > over.rect.top + over.rect.height / 2 : false
      const newIndex = isColumn
        ? overItems.length
        : overIndex >= 0
          ? overIndex + (isBelow ? 1 : 0)
          : overItems.length

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeIdValue),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeIdValue,
          ...overItems.slice(newIndex),
        ],
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setActiveType(null)
    if (!over) return
    const activeIdValue = String(active.id)
    const overId = String(over.id)

    if (active.data.current?.type === "column") {
      if (activeIdValue === overId) return
      const oldIndex = containers.indexOf(activeIdValue)
      const newIndex = containers.indexOf(findContainer(overId) ?? overId)
      if (oldIndex < 0 || newIndex < 0) return
      const next = arrayMove(containers, oldIndex, newIndex)
      setContainers(next)
      onReorderStages(next)
      return
    }

    const activeContainer = findContainer(activeIdValue)
    const overContainer = findContainer(overId)
    if (!activeContainer || !overContainer) return

    let finalIndex = items[overContainer]?.indexOf(activeIdValue) ?? 0
    if (activeContainer === overContainer) {
      const list = items[overContainer] ?? []
      const oldIndex = list.indexOf(activeIdValue)
      const overIndex = list.indexOf(overId)
      if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
        const reordered = arrayMove(list, oldIndex, overIndex)
        setItems((prev) => ({ ...prev, [overContainer]: reordered }))
        finalIndex = reordered.indexOf(activeIdValue)
      }
    }

    onMoveTask(activeIdValue, overContainer, Math.max(0, finalIndex))
  }

  const activeTask = activeType === "task" && activeId ? tasksById.get(activeId) : null
  const activeColumn = activeType === "column" && activeId ? stagesById.get(activeId) : null
  const orderedStages = containers
    .map((id) => stagesById.get(id))
    .filter((stage): stage is ProjectStage => Boolean(stage))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto pb-3">
        <SortableContext items={containers} strategy={horizontalListSortingStrategy}>
          {orderedStages.map((stage) => (
            <BoardColumn
              key={stage._id}
              stage={stage}
              taskIds={items[stage._id] ?? []}
              tasksById={tasksById}
              employees={employees}
              trackedByTask={trackedByTask}
              subtaskCountByTask={subtaskCountByTask}
              onOpenTask={onOpenTask}
              onRenameStage={onRenameStage}
              onRecolorStage={onRecolorStage}
              onArchiveStage={onArchiveStage}
              onQuickAddTask={onQuickAddTask}
              onAddTaskAdvanced={onAddTaskAdvanced}
            />
          ))}
        </SortableContext>
        <AddListAffordance onAddStage={onAddStage} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72">
            <TaskCardContent
              task={activeTask}
              employees={employees}
              trackedMinutes={trackedByTask[activeTask._id] ?? 0}
              subtaskCount={subtaskCountByTask[activeTask._id] ?? 0}
              accent={stageColor(stagesById.get(activeTask.stageId)?.color)}
              dragging
            />
          </div>
        ) : activeColumn ? (
          <div className="w-80 rounded-2xl border bg-muted/60 shadow-xl">
            <div
              className="flex items-center gap-2 rounded-t-2xl px-3 py-2.5"
              style={{ backgroundColor: `${stageColor(activeColumn.color)}1a` }}
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: stageColor(activeColumn.color) }}
              />
              <span className="flex-1 truncate text-sm font-semibold">{activeColumn.name}</span>
              <span className="rounded-full bg-background/70 px-1.5 text-xs font-medium text-muted-foreground">
                {items[activeColumn._id]?.length ?? 0}
              </span>
            </div>
            <div className="p-2">
              <PaletteIcon className="mx-auto my-6 size-5 text-muted-foreground" />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
