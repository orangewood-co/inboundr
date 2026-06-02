import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  ActivityIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarRangeIcon,
  ClockIcon,
  FolderKanbanIcon,
  GanttChartSquareIcon,
  GripVerticalIcon,
  KanbanSquareIcon,
  PlusIcon,
  SaveIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  archiveProjectStage,
  archiveProjectTask,
  createProjectStage,
  createProjectSubtask,
  createProjectTask,
  createProjectTimeEntry,
  getProject,
  getProjectReferenceData,
  moveProjectTask,
  reorderProjectStages,
  updateProject,
  updateProjectStage,
  updateProjectTask,
  type Project,
  type ProjectDetail,
  type ProjectEmployee,
  type ProjectStage,
  type ProjectTask,
  type ProjectTeam,
  type ProjectTimeEntry,
  type ProjectVisibility,
} from "@/lib/projects"
import { cn, getAvatarColor } from "@/lib/utils"

type TaskForm = {
  title: string
  description: string
  stageId: string
  assigneeIds: string[]
  startDate: string
  dueDate: string
  estimatedMinutes: string
}

type ProjectSettingsForm = {
  title: string
  description: string
  startDate: string
  dueDate: string
  visibility: ProjectVisibility
  visibleTeamIds: string[]
  memberIds: string[]
  managerIds: string[]
  followerIds: string[]
  status: Project["status"]
}

const emptyTaskForm: TaskForm = {
  title: "",
  description: "",
  stageId: "",
  assigneeIds: [],
  startDate: "",
  dueDate: "",
  estimatedMinutes: "",
}

function dateInputValue(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  const input = dateInputValue(value)
  if (!input) return "No date"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(input))
}

function formatMinutes(minutes?: number | null) {
  if (!minutes) return "0h"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IN"
  )
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return [...new Set([...values, value])]
  return values.filter((item) => item !== value)
}

function employeeName(employees: ProjectEmployee[], id: string) {
  return employees.find((employee) => employee._id === id)?.fullName ?? "Unknown"
}

function EmployeeAvatar({ employee }: { employee: ProjectEmployee }) {
  const palette = getAvatarColor(employee.fullName)
  return (
    <Avatar className="size-7">
      <AvatarFallback className={cn("text-[11px] font-semibold", palette.bg, palette.text)}>
        {initials(employee.fullName)}
      </AvatarFallback>
    </Avatar>
  )
}

function EmployeeChips({ employees, ids, limit = 4 }: { employees: ProjectEmployee[]; ids: string[]; limit?: number }) {
  const selected = ids.map((id) => employees.find((employee) => employee._id === id)).filter(Boolean) as ProjectEmployee[]
  if (selected.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>
  return (
    <div className="flex items-center -space-x-2">
      {selected.slice(0, limit).map((employee) => (
        <div key={employee._id} className="rounded-full border-2 border-card bg-card">
          <EmployeeAvatar employee={employee} />
        </div>
      ))}
      {selected.length > limit && (
        <span className="ml-3 rounded-full bg-muted px-2 py-1 text-xs font-medium">+{selected.length - limit}</span>
      )}
    </div>
  )
}

function MultiEmployeePicker({
  employees,
  value,
  onChange,
}: {
  employees: ProjectEmployee[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div className="grid max-h-52 gap-2 overflow-auto rounded-xl border bg-muted/20 p-2 sm:grid-cols-2">
      {employees.map((employee) => (
        <label key={employee._id} className="flex items-center gap-2 rounded-lg bg-background/80 p-2 text-sm">
          <Checkbox
            checked={value.includes(employee._id)}
            onCheckedChange={(checked) => onChange(toggleValue(value, employee._id, checked === true))}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{employee.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{employee.email}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function MultiTeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: ProjectTeam[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div className="grid gap-2 rounded-xl border bg-muted/20 p-2 sm:grid-cols-2">
      {teams.map((team) => (
        <label key={team._id} className="flex items-center gap-2 rounded-lg bg-background/80 p-2 text-sm">
          <Checkbox
            checked={value.includes(team._id)}
            onCheckedChange={(checked) => onChange(toggleValue(value, team._id, checked === true))}
          />
          <span className="font-medium">{team.name}</span>
        </label>
      ))}
      {teams.length === 0 && <p className="text-sm text-muted-foreground">No active teams found.</p>}
    </div>
  )
}

function DraggableTaskCard({
  task,
  employees,
  trackedMinutes,
  onOpen,
}: {
  task: ProjectTask
  employees: ProjectEmployee[]
  trackedMinutes: number
  onOpen: (task: ProjectTask) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { type: "task" },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition hover:border-foreground/20",
        isDragging && "z-50 opacity-70 shadow-xl"
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted"
          {...listeners}
          {...attributes}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
          <h3 className="line-clamp-2 text-sm font-semibold">{task.title}</h3>
          {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <EmployeeChips employees={employees} ids={task.assigneeIds} />
        <Badge variant="secondary" className="gap-1">
          <ClockIcon className="size-3" />
          {formatMinutes(trackedMinutes)}
        </Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarRangeIcon className="size-3.5" />
        <span>
          {formatDate(task.startDate)} - {formatDate(task.dueDate)}
        </span>
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  tasks,
  employees,
  timeEntries,
  stageName,
  onStageNameChange,
  onSaveStage,
  onArchiveStage,
  onCreateTask,
  onOpenTask,
}: {
  stage: ProjectStage
  tasks: ProjectTask[]
  employees: ProjectEmployee[]
  timeEntries: ProjectTimeEntry[]
  stageName: string
  onStageNameChange: (value: string) => void
  onSaveStage: () => void
  onArchiveStage: () => void
  onCreateTask: () => void
  onOpenTask: (task: ProjectTask) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage._id })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full min-w-80 flex-col rounded-3xl border bg-muted/20 p-3 transition",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <div className="mb-3 rounded-2xl bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: stage.color ?? "#64748b" }} />
          <Input value={stageName} onChange={(event) => onStageNameChange(event.target.value)} className="h-8" />
          <Button size="icon-sm" variant="ghost" onClick={onSaveStage}>
            <SaveIcon className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onArchiveStage}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge variant="secondary">{tasks.length} tasks</Badge>
          <Button size="sm" variant="outline" onClick={onCreateTask}>
            <PlusIcon />
            Task
          </Button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-auto">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task._id}
            task={task}
            employees={employees}
            trackedMinutes={timeEntries.filter((entry) => entry.taskId === task._id).reduce((sum, entry) => sum + entry.minutes, 0)}
            onOpen={onOpenTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
            Drop tasks here or create a new one.
          </div>
        )}
      </div>
    </section>
  )
}

function daysBetween(start: Date, end: Date) {
  const day = 24 * 60 * 60 * 1000
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / day)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dateOnly(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function GanttView({
  project,
  stages,
  tasks,
  employees,
  onOpenTask,
  onMoveTask,
}: {
  project: Project
  stages: ProjectStage[]
  tasks: ProjectTask[]
  employees: ProjectEmployee[]
  onOpenTask: (task: ProjectTask) => void
  onMoveTask: (task: ProjectTask, stageId: string, order: number, startDate?: string | null, dueDate?: string | null) => Promise<void>
}) {
  const dayWidth = 48
  const topTasks = tasks.filter((task) => !task.parentTaskId)
  const fallbackStart = dateOnly(project.startDate, new Date())
  const allDates = topTasks.flatMap((task) => [
    dateOnly(task.startDate, fallbackStart),
    dateOnly(task.dueDate, dateOnly(task.startDate, fallbackStart)),
  ])
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map((date) => date.getTime()))) : fallbackStart
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((date) => date.getTime()))) : addDays(fallbackStart, 14)
  const timelineStart = addDays(minDate, -2)
  const timelineEnd = addDays(maxDate, 7)
  const totalDays = Math.max(14, daysBetween(timelineStart, timelineEnd) + 1)
  const days = Array.from({ length: totalDays }, (_, index) => addDays(timelineStart, index))
  const [draftDates, setDraftDates] = useState<Record<string, { startDate: string; dueDate: string }>>({})
  const dragRef = useRef<{
    task: ProjectTask
    mode: "move" | "start" | "end"
    originX: number
    start: Date
    due: Date
  } | null>(null)

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const deltaDays = Math.round((event.clientX - drag.originX) / dayWidth)
      const duration = Math.max(0, daysBetween(drag.start, drag.due))
      let start = drag.start
      let due = drag.due
      if (drag.mode === "move") {
        start = addDays(drag.start, deltaDays)
        due = addDays(drag.due, deltaDays)
      } else if (drag.mode === "start") {
        start = addDays(drag.start, deltaDays)
        if (start > due) start = due
      } else {
        due = addDays(drag.due, deltaDays)
        if (due < start) due = addDays(start, duration)
      }
      setDraftDates((current) => ({
        ...current,
        [drag.task._id]: { startDate: toInputDate(start), dueDate: toInputDate(due) },
      }))
    }

    function handleUp() {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      const draft = draftDates[drag.task._id]
      if (!draft) return
      void onMoveTask(drag.task, drag.task.stageId, drag.task.order, draft.startDate, draft.dueDate)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [draftDates, onMoveTask])

  return (
    <div className="overflow-auto rounded-3xl border bg-card">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `18rem ${totalDays * dayWidth}px` }}>
        <div className="sticky left-0 z-20 border-r bg-card p-3 text-xs font-medium text-muted-foreground">
          Task
        </div>
        <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)` }}>
          {days.map((day) => (
            <div key={day.toISOString()} className="border-r p-2 text-center text-[11px] text-muted-foreground">
              <div>{day.toLocaleDateString([], { day: "2-digit" })}</div>
              <div>{day.toLocaleDateString([], { month: "short" })}</div>
            </div>
          ))}
        </div>

        {topTasks.map((task) => {
          const stage = stages.find((item) => item._id === task.stageId)
          const taskStart = dateOnly(draftDates[task._id]?.startDate ?? task.startDate, fallbackStart)
          const taskDue = dateOnly(draftDates[task._id]?.dueDate ?? task.dueDate, taskStart)
          const left = Math.max(0, daysBetween(timelineStart, taskStart) * dayWidth)
          const width = Math.max(dayWidth, (daysBetween(taskStart, taskDue) + 1) * dayWidth)
          return (
            <div key={task._id} className="contents">
              <button
                type="button"
                onClick={() => onOpenTask(task)}
                className="sticky left-0 z-10 flex min-h-16 items-center gap-3 border-t border-r bg-card p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{task.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{stage?.name ?? "Stage"}</span>
                    <EmployeeChips employees={employees} ids={task.assigneeIds} limit={2} />
                  </div>
                </div>
              </button>
              <div className="relative min-h-16 border-t bg-background">
                <div className="absolute inset-y-0 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)` }}>
                  {days.map((day) => (
                    <div key={day.toISOString()} className="border-r" />
                  ))}
                </div>
                <div
                  className="absolute top-1/2 flex h-8 -translate-y-1/2 items-center rounded-full bg-primary text-primary-foreground shadow-md"
                  style={{ left, width }}
                >
                  <button
                    type="button"
                    className="h-full w-4 cursor-ew-resize rounded-l-full bg-black/10"
                    onPointerDown={(event) => {
                      dragRef.current = { task, mode: "start", originX: event.clientX, start: taskStart, due: taskDue }
                    }}
                  />
                  <button
                    type="button"
                    className="flex h-full flex-1 cursor-grab items-center justify-center truncate px-3 text-xs font-medium"
                    onClick={() => onOpenTask(task)}
                    onPointerDown={(event) => {
                      dragRef.current = { task, mode: "move", originX: event.clientX, start: taskStart, due: taskDue }
                    }}
                  >
                    {formatDate(toInputDate(taskStart))} - {formatDate(toInputDate(taskDue))}
                  </button>
                  <button
                    type="button"
                    className="h-full w-4 cursor-ew-resize rounded-r-full bg-black/10"
                    onPointerDown={(event) => {
                      dragRef.current = { task, mode: "end", originX: event.clientX, start: taskStart, due: taskDue }
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {topTasks.length === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">Create tasks with dates to start building a timeline.</div>
      )}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams({ from: "/projects_/$id" })
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [employees, setEmployees] = useState<ProjectEmployee[]>([])
  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [newStageName, setNewStageName] = useState("")
  const [stageNames, setStageNames] = useState<Record<string, string>>({})
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsForm | null>(null)
  const [timeEntryForm, setTimeEntryForm] = useState({ employeeId: "", minutes: "", workDate: todayInputValue(), notes: "" })
  const [subtaskTitle, setSubtaskTitle] = useState("")

  const refresh = useCallback(async () => {
    const [projectDetail, referenceData] = await Promise.all([getProject(id), getProjectReferenceData()])
    setDetail(projectDetail)
    setEmployees(referenceData.employees)
    setTeams(referenceData.teams)
    setStageNames(Object.fromEntries(projectDetail.stages.map((stage) => [stage._id, stage.name])))
    setSettingsForm({
      title: projectDetail.project.title,
      description: projectDetail.project.description ?? "",
      startDate: dateInputValue(projectDetail.project.startDate),
      dueDate: dateInputValue(projectDetail.project.dueDate),
      visibility: projectDetail.project.visibility,
      visibleTeamIds: projectDetail.project.visibleTeamIds,
      memberIds: projectDetail.project.memberIds,
      managerIds: projectDetail.project.managerIds,
      followerIds: projectDetail.project.followerIds,
      status: projectDetail.project.status,
    })
    setLoading(false)
  }, [id])

  useEffect(() => {
    void refresh().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load project")
      setLoading(false)
    })
  }, [refresh])

  const project = detail?.project
  const stages = detail?.stages ?? []
  const tasks = detail?.tasks ?? []
  const timeEntries = detail?.timeEntries ?? []
  const activities = detail?.activities ?? []
  const topTasks = tasks.filter((task) => !task.parentTaskId)
  const selectedTask = tasks.find((task) => task._id === selectedTaskId) ?? null
  const selectedSubtasks = selectedTask ? tasks.filter((task) => task.parentTaskId === selectedTask._id) : []
  const selectedTimeEntries = selectedTask ? timeEntries.filter((entry) => entry.taskId === selectedTask._id) : []

  useEffect(() => {
    if (!selectedTask) return
    setTaskForm({
      title: selectedTask.title,
      description: selectedTask.description ?? "",
      stageId: selectedTask.stageId,
      assigneeIds: selectedTask.assigneeIds,
      startDate: dateInputValue(selectedTask.startDate),
      dueDate: dateInputValue(selectedTask.dueDate),
      estimatedMinutes: selectedTask.estimatedMinutes ? String(selectedTask.estimatedMinutes) : "",
    })
    setTimeEntryForm({
      employeeId: selectedTask.assigneeIds[0] ?? employees[0]?._id ?? "",
      minutes: "",
      workDate: todayInputValue(),
      notes: "",
    })
  }, [employees, selectedTask])

  const taskMinutes = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of timeEntries) {
      totals.set(entry.taskId, (totals.get(entry.taskId) ?? 0) + entry.minutes)
    }
    return totals
  }, [timeEntries])

  async function handleCreateStage() {
    if (!project || !newStageName.trim()) return
    try {
      await createProjectStage(project._id, { name: newStageName.trim() })
      setNewStageName("")
      toast.success("Stage created")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create stage")
    }
  }

  async function handleSaveStage(stage: ProjectStage) {
    if (!project) return
    try {
      await updateProjectStage(project._id, stage._id, { name: stageNames[stage._id] ?? stage.name, color: stage.color })
      toast.success("Stage updated")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage")
    }
  }

  async function handleArchiveStage(stage: ProjectStage) {
    if (!project) return
    try {
      await archiveProjectStage(project._id, stage._id)
      toast.success("Stage archived")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive stage")
    }
  }

  async function handleReorderStages(direction: "left" | "right", stage: ProjectStage) {
    if (!project) return
    const index = stages.findIndex((item) => item._id === stage._id)
    const target = direction === "left" ? index - 1 : index + 1
    if (target < 0 || target >= stages.length) return
    const next = [...stages]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    try {
      await reorderProjectStages(project._id, next.map((item) => item._id))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder stages")
    }
  }

  function openCreateTask(stageId: string) {
    setTaskForm({ ...emptyTaskForm, stageId })
    setTaskDialogOpen(true)
  }

  async function handleCreateTask(event: React.FormEvent) {
    event.preventDefault()
    if (!project || !taskForm.title.trim()) return
    try {
      await createProjectTask(project._id, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        stageId: taskForm.stageId,
        assigneeIds: taskForm.assigneeIds,
        startDate: taskForm.startDate || null,
        dueDate: taskForm.dueDate || null,
        estimatedMinutes: taskForm.estimatedMinutes ? Number(taskForm.estimatedMinutes) : null,
      })
      setTaskDialogOpen(false)
      toast.success("Task created")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }

  const handleMoveTask = useCallback(
    async (task: ProjectTask, stageId: string, order: number, startDate?: string | null, dueDate?: string | null) => {
      if (!project) return
      await moveProjectTask(project._id, task._id, { stageId, order, startDate, dueDate })
      await refresh()
    },
    [project, refresh]
  )

  async function handleDragEnd(event: DragEndEvent) {
    if (!project || !event.over) return
    const task = tasks.find((item) => item._id === event.active.id)
    const targetStageId = String(event.over.id)
    if (!task || task.stageId === targetStageId || task.parentTaskId) return
    try {
      const order = topTasks.filter((item) => item.stageId === targetStageId).length
      await handleMoveTask(task, targetStageId, order)
      toast.success("Task moved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move task")
    }
  }

  async function handleSaveSelectedTask() {
    if (!project || !selectedTask) return
    try {
      await updateProjectTask(project._id, selectedTask._id, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        stageId: taskForm.stageId,
        assigneeIds: taskForm.assigneeIds,
        startDate: taskForm.startDate || null,
        dueDate: taskForm.dueDate || null,
        estimatedMinutes: taskForm.estimatedMinutes ? Number(taskForm.estimatedMinutes) : null,
      })
      toast.success("Task saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task")
    }
  }

  async function handleArchiveSelectedTask() {
    if (!project || !selectedTask) return
    try {
      await archiveProjectTask(project._id, selectedTask._id)
      setSelectedTaskId(null)
      toast.success("Task archived")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive task")
    }
  }

  async function handleCreateSubtask(event: React.FormEvent) {
    event.preventDefault()
    if (!project || !selectedTask || !subtaskTitle.trim()) return
    try {
      await createProjectSubtask(project._id, selectedTask._id, {
        title: subtaskTitle.trim(),
        description: null,
        stageId: selectedTask.stageId,
        assigneeIds: selectedTask.assigneeIds,
        startDate: selectedTask.startDate ? dateInputValue(selectedTask.startDate) : null,
        dueDate: selectedTask.dueDate ? dateInputValue(selectedTask.dueDate) : null,
        estimatedMinutes: null,
      })
      setSubtaskTitle("")
      toast.success("Subtask added")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add subtask")
    }
  }

  async function handleCreateTimeEntry(event: React.FormEvent) {
    event.preventDefault()
    if (!project || !selectedTask) return
    try {
      await createProjectTimeEntry(project._id, selectedTask._id, {
        employeeId: timeEntryForm.employeeId,
        minutes: Number(timeEntryForm.minutes),
        workDate: timeEntryForm.workDate,
        notes: timeEntryForm.notes.trim() || null,
      })
      setTimeEntryForm((current) => ({ ...current, minutes: "", notes: "" }))
      toast.success("Time logged")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log time")
    }
  }

  async function handleSaveSettings() {
    if (!project || !settingsForm) return
    try {
      const updated = await updateProject(project._id, {
        title: settingsForm.title.trim(),
        description: settingsForm.description.trim() || null,
        startDate: settingsForm.startDate || null,
        dueDate: settingsForm.dueDate || null,
        visibility: settingsForm.visibility,
        visibleTeamIds: settingsForm.visibility === "teams" ? settingsForm.visibleTeamIds : [],
        memberIds: settingsForm.memberIds,
        managerIds: settingsForm.managerIds,
        followerIds: settingsForm.followerIds,
        status: settingsForm.status,
      })
      setDetail(updated)
      setSettingsOpen(false)
      toast.success("Project settings saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save project")
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader />
        <main className="space-y-4 p-6">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-[32rem] rounded-3xl" />
        </main>
      </AppLayout>
    )
  }

  if (!project) {
    return (
      <AppLayout>
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <FolderKanbanIcon className="mx-auto size-12 text-muted-foreground/50" />
            <h1 className="mt-4 text-xl font-semibold">Project not found</h1>
            <Button className="mt-4" asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.title },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/projects">
                <ArrowLeftIcon />
                Projects
              </Link>
            </Button>
            <Button size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2Icon />
              Settings
            </Button>
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <section className="mb-5 rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{project.visibility}</Badge>
                <Badge>{project.status}</Badge>
                <Badge variant="outline" className="gap-1">
                  <UsersIcon className="size-3" />
                  {new Set([...project.memberIds, ...project.managerIds, ...project.followerIds]).size} people
                </Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{project.description || "No description yet."}</p>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:min-w-80">
              <div className="rounded-2xl bg-muted/40 p-3">
                <span className="block text-xs">Start</span>
                <span className="font-medium text-foreground">{formatDate(project.startDate)}</span>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <span className="block text-xs">Due</span>
                <span className="font-medium text-foreground">{formatDate(project.dueDate)}</span>
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="kanban" className="min-h-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="kanban">
                <KanbanSquareIcon />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="gantt">
                <GanttChartSquareIcon />
                Gantt
              </TabsTrigger>
              <TabsTrigger value="activity">
                <ActivityIcon />
                Activity
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Input
                value={newStageName}
                onChange={(event) => setNewStageName(event.target.value)}
                placeholder="New stage name"
                className="w-48"
              />
              <Button onClick={handleCreateStage}>
                <PlusIcon />
                Stage
              </Button>
            </div>
          </div>

          <TabsContent value="kanban" className="min-h-0 overflow-hidden">
            <DndContext onDragEnd={handleDragEnd}>
              <div className="flex h-[calc(100svh-20rem)] gap-4 overflow-auto pb-4">
                {stages.map((stage) => (
                  <div key={stage._id} className="flex flex-col gap-2">
                    <KanbanColumn
                      stage={stage}
                      tasks={topTasks.filter((task) => task.stageId === stage._id).sort((a, b) => a.order - b.order)}
                      employees={employees}
                      timeEntries={timeEntries}
                      stageName={stageNames[stage._id] ?? stage.name}
                      onStageNameChange={(value) => setStageNames((current) => ({ ...current, [stage._id]: value }))}
                      onSaveStage={() => void handleSaveStage(stage)}
                      onArchiveStage={() => void handleArchiveStage(stage)}
                      onCreateTask={() => openCreateTask(stage._id)}
                      onOpenTask={(task) => setSelectedTaskId(task._id)}
                    />
                    <div className="flex justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => void handleReorderStages("left", stage)}>
                        Move left
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleReorderStages("right", stage)}>
                        Move right
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DndContext>
          </TabsContent>

          <TabsContent value="gantt" className="min-h-0 overflow-auto">
            <GanttView
              project={project}
              stages={stages}
              tasks={tasks}
              employees={employees}
              onOpenTask={(task) => setSelectedTaskId(task._id)}
              onMoveTask={handleMoveTask}
            />
          </TabsContent>

          <TabsContent value="activity" className="overflow-auto rounded-3xl border bg-card p-4">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity._id} className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <Badge variant="secondary">{activity.type.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {activities.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreateTask}>
            <DialogHeader>
              <DialogTitle>Create task</DialogTitle>
              <DialogDescription>Add a new top-level task to this project board.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              <Field>
                <FieldLabel>Title</FieldLabel>
                <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Stage</FieldLabel>
                  <Select value={taskForm.stageId} onValueChange={(stageId) => setTaskForm((current) => ({ ...current, stageId }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage._id} value={stage._id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Start</FieldLabel>
                  <Input type="date" value={taskForm.startDate} onChange={(event) => setTaskForm((current) => ({ ...current, startDate: event.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>Due</FieldLabel>
                  <Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                </Field>
              </div>
              <Field>
                <FieldLabel>Assignees</FieldLabel>
                <MultiEmployeePicker employees={employees} value={taskForm.assigneeIds} onChange={(assigneeIds) => setTaskForm((current) => ({ ...current, assigneeIds }))} />
              </Field>
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit">Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full overflow-auto sm:max-w-2xl">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle>Task details</SheetTitle>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-8">
                <Field>
                  <FieldLabel>Title</FieldLabel>
                  <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Stage</FieldLabel>
                    <Select value={taskForm.stageId} onValueChange={(stageId) => setTaskForm((current) => ({ ...current, stageId }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage._id} value={stage._id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Estimate (minutes)</FieldLabel>
                    <Input type="number" value={taskForm.estimatedMinutes} onChange={(event) => setTaskForm((current) => ({ ...current, estimatedMinutes: event.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>Start</FieldLabel>
                    <Input type="date" value={taskForm.startDate} onChange={(event) => setTaskForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </Field>
                  <Field>
                    <FieldLabel>Due</FieldLabel>
                    <Input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Assignees</FieldLabel>
                  <MultiEmployeePicker employees={employees} value={taskForm.assigneeIds} onChange={(assigneeIds) => setTaskForm((current) => ({ ...current, assigneeIds }))} />
                </Field>
                <div className="flex gap-2">
                  <Button onClick={() => void handleSaveSelectedTask()}>
                    <SaveIcon />
                    Save task
                  </Button>
                  <Button variant="outline" onClick={() => void handleArchiveSelectedTask()}>
                    <ArchiveIcon />
                    Archive
                  </Button>
                </div>

                <section className="rounded-2xl border p-4">
                  <h3 className="font-semibold">Subtasks</h3>
                  <form onSubmit={handleCreateSubtask} className="mt-3 flex gap-2">
                    <Input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask..." />
                    <Button type="submit">
                      <PlusIcon />
                      Add
                    </Button>
                  </form>
                  <div className="mt-3 space-y-2">
                    {selectedSubtasks.map((subtask) => (
                      <button
                        key={subtask._id}
                        type="button"
                        onClick={() => setSelectedTaskId(subtask._id)}
                        className="flex w-full items-center justify-between rounded-xl bg-muted/40 p-3 text-left text-sm"
                      >
                        <span>{subtask.title}</span>
                        <Badge variant="secondary">{employeeName(employees, subtask.assigneeIds[0] ?? "")}</Badge>
                      </button>
                    ))}
                    {selectedSubtasks.length === 0 && <p className="text-sm text-muted-foreground">No subtasks yet.</p>}
                  </div>
                </section>

                <section className="rounded-2xl border p-4">
                  <h3 className="font-semibold">Manual time tracking</h3>
                  <form onSubmit={handleCreateTimeEntry} className="mt-3 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Select value={timeEntryForm.employeeId} onValueChange={(employeeId) => setTimeEntryForm((current) => ({ ...current, employeeId }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee._id} value={employee._id}>
                              {employee.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={timeEntryForm.minutes}
                        onChange={(event) => setTimeEntryForm((current) => ({ ...current, minutes: event.target.value }))}
                        placeholder="Minutes"
                      />
                      <Input
                        type="date"
                        value={timeEntryForm.workDate}
                        onChange={(event) => setTimeEntryForm((current) => ({ ...current, workDate: event.target.value }))}
                      />
                    </div>
                    <Input
                      value={timeEntryForm.notes}
                      onChange={(event) => setTimeEntryForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Notes"
                    />
                    <Button type="submit" variant="outline">
                      <ClockIcon />
                      Log time
                    </Button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {selectedTimeEntries.map((entry) => (
                      <div key={entry._id} className="rounded-xl bg-muted/40 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{formatMinutes(entry.minutes)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(entry.workDate)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {employeeName(employees, entry.employeeId)}{entry.notes ? ` - ${entry.notes}` : ""}
                        </p>
                      </div>
                    ))}
                    {selectedTimeEntries.length === 0 && <p className="text-sm text-muted-foreground">No time logged yet.</p>}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90svh] max-w-3xl overflow-auto">
          {settingsForm && (
            <>
              <DialogHeader>
                <DialogTitle>Project settings</DialogTitle>
                <DialogDescription>Update metadata, visibility, managers, members, and followers.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <Field>
                  <FieldLabel>Title</FieldLabel>
                  <Input value={settingsForm.title} onChange={(event) => setSettingsForm((current) => current && { ...current, title: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={settingsForm.description}
                    onChange={(event) => setSettingsForm((current) => current && { ...current, description: event.target.value })}
                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select value={settingsForm.status} onValueChange={(status) => setSettingsForm((current) => current && { ...current, status: status as Project["status"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Start</FieldLabel>
                    <Input type="date" value={settingsForm.startDate} onChange={(event) => setSettingsForm((current) => current && { ...current, startDate: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel>Due</FieldLabel>
                    <Input type="date" value={settingsForm.dueDate} onChange={(event) => setSettingsForm((current) => current && { ...current, dueDate: event.target.value })} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Visibility</FieldLabel>
                  <Select value={settingsForm.visibility} onValueChange={(visibility) => setSettingsForm((current) => current && { ...current, visibility: visibility as ProjectVisibility })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">All internal users</SelectItem>
                      <SelectItem value="private">Invited or added users</SelectItem>
                      <SelectItem value="teams">Respective teams</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {settingsForm.visibility === "teams" && (
                  <Field>
                    <FieldLabel>Visible teams</FieldLabel>
                    <FieldDescription>Members of these teams can access the project.</FieldDescription>
                    <MultiTeamPicker
                      teams={teams}
                      value={settingsForm.visibleTeamIds}
                      onChange={(visibleTeamIds) => setSettingsForm((current) => current && { ...current, visibleTeamIds })}
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel>Project managers</FieldLabel>
                  <MultiEmployeePicker employees={employees} value={settingsForm.managerIds} onChange={(managerIds) => setSettingsForm((current) => current && { ...current, managerIds })} />
                </Field>
                <Field>
                  <FieldLabel>Members</FieldLabel>
                  <MultiEmployeePicker employees={employees} value={settingsForm.memberIds} onChange={(memberIds) => setSettingsForm((current) => current && { ...current, memberIds })} />
                </Field>
                <Field>
                  <FieldLabel>Followers</FieldLabel>
                  <FieldDescription>Followers receive targeted email notifications for important updates.</FieldDescription>
                  <MultiEmployeePicker employees={employees} value={settingsForm.followerIds} onChange={(followerIds) => setSettingsForm((current) => current && { ...current, followerIds })} />
                </Field>
              </div>
              <DialogFooter className="mt-6">
                <Button onClick={() => void handleSaveSettings()}>
                  <SaveIcon />
                  Save settings
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
