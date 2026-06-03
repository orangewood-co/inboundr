import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { ArchiveIcon, ArrowLeftIcon, ClockIcon, FolderKanbanIcon, PlusIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { MultiEmployeePicker } from "@/components/projects/people-picker"
import {
  DueDatePill,
  dateInputValue,
  employeeName,
  formatDate,
  formatMinutes,
  stageColor,
  todayInputValue,
} from "@/components/projects/board-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  archiveProjectTask,
  createProjectSubtask,
  createProjectTimeEntry,
  getProject,
  getProjectReferenceData,
  updateProjectTask,
  type ProjectDetail,
  type ProjectEmployee,
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

const emptyTaskForm: TaskForm = {
  title: "",
  description: "",
  stageId: "",
  assigneeIds: [],
  startDate: "",
  dueDate: "",
  estimatedMinutes: "",
}

export default function ProjectTaskPage() {
  const { id, taskId } = useParams({ from: "/projects_/$id_/tasks/$taskId" })
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [employees, setEmployees] = useState<ProjectEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [timeEntryForm, setTimeEntryForm] = useState({ employeeId: "", minutes: "", workDate: todayInputValue(), notes: "" })
  const [subtaskTitle, setSubtaskTitle] = useState("")

  const refresh = useCallback(async () => {
    const [projectDetail, referenceData] = await Promise.all([getProject(id), getProjectReferenceData()])
    setDetail(projectDetail)
    setEmployees(referenceData.employees)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void refresh().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load task")
      setLoading(false)
    })
  }, [refresh])

  const project = detail?.project
  const stages = detail?.stages ?? []
  const tasks = detail?.tasks ?? []
  const task = tasks.find((item) => item._id === taskId) ?? null
  const subtasks = tasks.filter((item) => item.parentTaskId === taskId)
  const timeEntries = (detail?.timeEntries ?? []).filter((entry) => entry.taskId === taskId)
  const stage = stages.find((item) => item._id === task?.stageId)

  useEffect(() => {
    if (!task) return
    setTaskForm({
      title: task.title,
      description: task.description ?? "",
      stageId: task.stageId,
      assigneeIds: task.assigneeIds,
      startDate: dateInputValue(task.startDate),
      dueDate: dateInputValue(task.dueDate),
      estimatedMinutes: task.estimatedMinutes ? String(task.estimatedMinutes) : "",
    })
    setTimeEntryForm({
      employeeId: task.assigneeIds[0] ?? employees[0]?._id ?? "",
      minutes: "",
      workDate: todayInputValue(),
      notes: "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task?._id])

  function goBack() {
    void navigate({ to: "/projects/$id", params: { id } })
  }

  async function handleSave() {
    if (!project || !task) return
    if (!taskForm.title.trim()) {
      toast.error("Task title is required")
      return
    }
    try {
      await updateProjectTask(project._id, task._id, {
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

  async function handleArchive() {
    if (!project || !task) return
    try {
      await archiveProjectTask(project._id, task._id)
      toast.success("Task archived")
      goBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive task")
    }
  }

  async function handleCreateSubtask(event: FormEvent) {
    event.preventDefault()
    if (!project || !task || !subtaskTitle.trim()) return
    try {
      await createProjectSubtask(project._id, task._id, {
        title: subtaskTitle.trim(),
        description: null,
        stageId: task.stageId,
        assigneeIds: task.assigneeIds,
        startDate: task.startDate ? dateInputValue(task.startDate) : null,
        dueDate: task.dueDate ? dateInputValue(task.dueDate) : null,
        estimatedMinutes: null,
      })
      setSubtaskTitle("")
      toast.success("Subtask added")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add subtask")
    }
  }

  async function handleCreateTimeEntry(event: FormEvent) {
    event.preventDefault()
    if (!project || !task) return
    try {
      await createProjectTimeEntry(project._id, task._id, {
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

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl space-y-4 p-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </AppLayout>
    )
  }

  if (!project || !task) {
    return (
      <AppLayout>
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <FolderKanbanIcon className="mx-auto size-12 text-muted-foreground/50" />
            <h1 className="mt-4 text-xl font-semibold">Task Not Found</h1>
            <Button className="mt-4" asChild>
              <Link to="/projects/$id" params={{ id }}>
                Back to Board
              </Link>
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
          { label: project.title, href: `/projects/${id}` },
          { label: task.title },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeftIcon />
              Board
            </Button>
            <Button size="sm" onClick={() => void handleSave()}>
              <SaveIcon />
              Save
            </Button>
          </>
        }
      />
      <main className="mx-auto w-full max-w-4xl space-y-5 overflow-auto p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: stageColor(stage?.color) }} />
          <h1 className="flex-1 text-2xl font-semibold tracking-tight">{task.title}</h1>
          {task.parentTaskId && <Badge variant="secondary">Subtask</Badge>}
          <DueDatePill due={task.dueDate} />
        </div>

        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={taskForm.description}
              onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  {stages.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Estimate (minutes)</FieldLabel>
              <Input
                type="number"
                value={taskForm.estimatedMinutes}
                onChange={(event) => setTaskForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
              />
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
            <Button onClick={() => void handleSave()}>
              <SaveIcon />
              Save Task
            </Button>
            <Button variant="outline" onClick={() => void handleArchive()}>
              <ArchiveIcon />
              Archive
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Subtasks</h2>
          <form onSubmit={handleCreateSubtask} className="mt-3 flex gap-2">
            <Input value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="Add a subtask..." />
            <Button type="submit">
              <PlusIcon />
              Add
            </Button>
          </form>
          <div className="mt-3 space-y-2">
            {subtasks.map((subtask) => (
              <button
                key={subtask._id}
                type="button"
                onClick={() => void navigate({ to: "/projects/$id/tasks/$taskId", params: { id, taskId: subtask._id } })}
                className="flex w-full items-center justify-between rounded-xl bg-muted/40 p-3 text-left text-sm transition hover:bg-muted"
              >
                <span>{subtask.title}</span>
                <Badge variant="secondary">{employeeName(employees, subtask.assigneeIds[0] ?? "")}</Badge>
              </button>
            ))}
            {subtasks.length === 0 && <p className="text-sm text-muted-foreground">No subtasks yet.</p>}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Manual Time Tracking</h2>
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
              Log Time
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            {timeEntries.map((entry) => (
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
            {timeEntries.length === 0 && <p className="text-sm text-muted-foreground">No time logged yet.</p>}
          </div>
        </section>
      </main>
    </AppLayout>
  )
}
