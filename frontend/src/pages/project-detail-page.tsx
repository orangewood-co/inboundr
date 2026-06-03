import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  ActivityIcon,
  ArrowLeftIcon,
  FolderKanbanIcon,
  GanttChartSquareIcon,
  KanbanSquareIcon,
  PlusIcon,
  SaveIcon,
  Settings2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { ProjectBoard } from "@/components/projects/project-board"
import { MultiEmployeePicker } from "@/components/projects/people-picker"
import {
  EmployeeStack,
  dateInputValue,
  formatDate,
  stageColor,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  archiveProjectStage,
  createProjectStage,
  createProjectTask,
  getProject,
  getProjectReferenceData,
  moveProjectTask,
  reorderProjectStages,
  updateProject,
  updateProjectStage,
  type Project,
  type ProjectDetail,
  type ProjectEmployee,
  type ProjectStage,
  type ProjectTask,
  type ProjectTeam,
  type ProjectVisibility,
} from "@/lib/projects"

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
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [employees, setEmployees] = useState<ProjectEmployee[]>([])
  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsForm | null>(null)

  const openTask = useCallback(
    (taskId: string) => {
      void navigate({ to: "/projects/$id/tasks/$taskId", params: { id, taskId } })
    },
    [id, navigate]
  )

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
      toast.error("Add a stage before creating tasks")
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
        toast.error(err instanceof Error ? err.message : "Failed to reorder stages")
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
        toast.error(err instanceof Error ? err.message : "Failed to rename stage")
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
        toast.error(err instanceof Error ? err.message : "Failed to update stage color")
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
        toast.success("Stage archived")
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to archive stage")
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
        toast.error(err instanceof Error ? err.message : "Failed to add task")
      }
    },
    [project, refresh]
  )

  const handleAddStage = useCallback(
    async (name: string) => {
      if (!project) return
      try {
        await createProjectStage(project._id, { name })
        toast.success("Stage added")
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add stage")
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
            <h1 className="mt-4 text-xl font-semibold">Project Not Found</h1>
            <Button className="mt-4" asChild>
              <Link to="/projects">Back to Projects</Link>
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
              New Task
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
                onOpenTask={openTask}
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
              onOpenTask={(task) => openTask(task._id)}
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
              <DialogTitle>Create Task</DialogTitle>
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
              <Button type="submit">Create Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90svh] max-w-3xl overflow-auto">
          {settingsForm && (
            <>
              <DialogHeader>
                <DialogTitle>Project Settings</DialogTitle>
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
                      <SelectItem value="internal">All Internal Users</SelectItem>
                      <SelectItem value="private">Invited or Added Users</SelectItem>
                      <SelectItem value="teams">Respective Teams</SelectItem>
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
                  Save Settings
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
