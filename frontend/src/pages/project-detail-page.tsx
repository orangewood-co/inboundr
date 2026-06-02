import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import {
  ActivityIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarRangeIcon,
  ClockIcon,
  FolderKanbanIcon,
  GanttChartSquareIcon,
  GlobeIcon,
  KanbanSquareIcon,
  LockIcon,
  PlusIcon,
  SaveIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ProjectBoard } from "@/components/projects/project-board"
import {
  DueDatePill,
  EmployeeStack,
  dateInputValue,
  employeeName,
  formatDate,
  formatMinutes,
  stageColor,
  todayInputValue,
  toggleValue,
} from "@/components/projects/board-ui"
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
  type ProjectVisibility,
} from "@/lib/projects"
import { cn } from "@/lib/utils"

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

const STATUS_TONE: Record<Project["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  archived: "bg-muted text-muted-foreground",
}

const VISIBILITY_META: Record<
  ProjectVisibility,
  { icon: typeof GlobeIcon; label: string }
> = {
  internal: { icon: GlobeIcon, label: "All internal users" },
  private: { icon: LockIcon, label: "Invited users" },
  teams: { icon: UsersIcon, label: "Respective teams" },
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
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: stageColor(stage?.color) }}
                    />
                    <span className="truncate">{stage?.name ?? "Stage"}</span>
                    <EmployeeStack employees={employees} ids={task.assigneeIds} limit={2} emptyLabel={null} />
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
                  className="absolute top-1/2 flex h-8 -translate-y-1/2 items-center rounded-full text-white shadow-md"
                  style={{ left, width, backgroundColor: stageColor(stage?.color) }}
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

  const trackedByTask = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const entry of timeEntries) {
      totals[entry.taskId] = (totals[entry.taskId] ?? 0) + entry.minutes
    }
    return totals
  }, [timeEntries])

  const subtaskCountByTask = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const task of tasks) {
      if (task.parentTaskId) counts[task.parentTaskId] = (counts[task.parentTaskId] ?? 0) + 1
    }
    return counts
  }, [tasks])

  const patchDetail = useCallback((updater: (current: ProjectDetail) => ProjectDetail) => {
    setDetail((current) => (current ? updater(current) : current))
  }, [])

  function openCreateTask(stageId?: string) {
    setTaskForm({ ...emptyTaskForm, stageId: stageId ?? stages[0]?._id ?? "" })
    setTaskDialogOpen(true)
  }

  async function handleCreateTask(event: React.FormEvent) {
    event.preventDefault()
    if (!project || !taskForm.title.trim()) return
    if (!taskForm.stageId) {
      toast.error("Add a list before creating tasks")
      return
    }
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

  const handlePersistTaskMove = useCallback(
    async (taskId: string, stageId: string, order: number) => {
      if (!project) return
      patchDetail((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task._id === taskId ? { ...task, stageId, order } : task
        ),
      }))
      try {
        await moveProjectTask(project._id, taskId, { stageId, order })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move task")
        void refresh()
      }
    },
    [patchDetail, project, refresh]
  )

  const handleReorderStages = useCallback(
    async (stageIds: string[]) => {
      if (!project) return
      patchDetail((current) => ({
        ...current,
        stages: [...current.stages]
          .sort((a, b) => stageIds.indexOf(a._id) - stageIds.indexOf(b._id))
          .map((stage, index) => ({ ...stage, order: index })),
      }))
      try {
        await reorderProjectStages(project._id, stageIds)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reorder lists")
        void refresh()
      }
    },
    [patchDetail, project, refresh]
  )

  const handleRenameStage = useCallback(
    async (stageId: string, name: string) => {
      if (!project) return
      patchDetail((current) => ({
        ...current,
        stages: current.stages.map((stage) => (stage._id === stageId ? { ...stage, name } : stage)),
      }))
      try {
        await updateProjectStage(project._id, stageId, { name })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to rename list")
        void refresh()
      }
    },
    [patchDetail, project, refresh]
  )

  const handleRecolorStage = useCallback(
    async (stageId: string, color: string) => {
      if (!project) return
      patchDetail((current) => ({
        ...current,
        stages: current.stages.map((stage) => (stage._id === stageId ? { ...stage, color } : stage)),
      }))
      try {
        await updateProjectStage(project._id, stageId, { color })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update list color")
        void refresh()
      }
    },
    [patchDetail, project, refresh]
  )

  const handleArchiveStage = useCallback(
    async (stageId: string) => {
      if (!project) return
      try {
        await archiveProjectStage(project._id, stageId)
        toast.success("List archived")
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to archive list")
      }
    },
    [project, refresh]
  )

  const handleQuickAddTask = useCallback(
    async (stageId: string, title: string) => {
      if (!project) return
      try {
        await createProjectTask(project._id, { title, stageId })
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add card")
      }
    },
    [project, refresh]
  )

  const handleAddStage = useCallback(
    async (name: string) => {
      if (!project) return
      try {
        await createProjectStage(project._id, { name })
        toast.success("List added")
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add list")
      }
    },
    [project, refresh]
  )

  const handleGanttMove = useCallback(
    async (
      task: ProjectTask,
      stageId: string,
      order: number,
      startDate?: string | null,
      dueDate?: string | null
    ) => {
      if (!project) return
      patchDetail((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item._id === task._id
            ? {
                ...item,
                stageId,
                order,
                startDate: startDate ?? item.startDate,
                dueDate: dueDate ?? item.dueDate,
              }
            : item
        ),
      }))
      try {
        await moveProjectTask(project._id, task._id, { stageId, order, startDate, dueDate })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update task dates")
        void refresh()
      }
    },
    [patchDetail, project, refresh]
  )

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
        <section className="mb-5 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div
            className="h-1.5 w-full"
            style={{
              backgroundImage: stages.length
                ? `linear-gradient(to right, ${stages.map((stage) => stageColor(stage.color)).join(", ")})`
                : undefined,
              backgroundColor: stages.length ? undefined : "var(--primary)",
            }}
          />
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    STATUS_TONE[project.status]
                  )}
                >
                  {project.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {project.visibility === "internal" ? (
                    <GlobeIcon className="size-3" />
                  ) : project.visibility === "private" ? (
                    <LockIcon className="size-3" />
                  ) : (
                    <UsersIcon className="size-3" />
                  )}
                  {VISIBILITY_META[project.visibility].label}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">{project.title}</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
                {project.description || "No description yet."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <EmployeeStack
                  employees={employees}
                  ids={[...new Set([...project.managerIds, ...project.memberIds])]}
                  limit={6}
                  emptyLabel="No members yet"
                />
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarRangeIcon className="size-4" />
                  {formatDate(project.startDate)} - {formatDate(project.dueDate)}
                </span>
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
            <Button size="sm" onClick={() => openCreateTask()} disabled={stages.length === 0}>
              <PlusIcon />
              New task
            </Button>
          </div>

          <TabsContent value="kanban" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-[calc(100svh-21rem)]">
              <ProjectBoard
                stages={stages}
                tasks={topTasks}
                employees={employees}
                trackedByTask={trackedByTask}
                subtaskCountByTask={subtaskCountByTask}
                onOpenTask={(taskId) => setSelectedTaskId(taskId)}
                onMoveTask={(taskId, stageId, order) => void handlePersistTaskMove(taskId, stageId, order)}
                onReorderStages={(ids) => void handleReorderStages(ids)}
                onRenameStage={(stageId, name) => void handleRenameStage(stageId, name)}
                onRecolorStage={(stageId, color) => void handleRecolorStage(stageId, color)}
                onArchiveStage={(stageId) => void handleArchiveStage(stageId)}
                onQuickAddTask={(stageId, title) => void handleQuickAddTask(stageId, title)}
                onAddStage={(name) => void handleAddStage(name)}
                onAddTaskAdvanced={(stageId) => openCreateTask(stageId)}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="min-h-0 overflow-auto">
            <GanttView
              project={project}
              stages={stages}
              tasks={tasks}
              employees={employees}
              onOpenTask={(task) => setSelectedTaskId(task._id)}
              onMoveTask={handleGanttMove}
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
              <SheetHeader className="border-b">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: stageColor(
                        stages.find((stage) => stage._id === selectedTask.stageId)?.color
                      ),
                    }}
                  />
                  <SheetTitle className="flex-1 truncate">{selectedTask.title}</SheetTitle>
                  {selectedTask.parentTaskId && <Badge variant="secondary">Subtask</Badge>}
                  <DueDatePill due={selectedTask.dueDate} />
                </div>
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
