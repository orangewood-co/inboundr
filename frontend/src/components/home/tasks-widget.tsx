import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { CheckCircle2Icon, ListChecksIcon } from "lucide-react"

import { getMyTasks, type MyTask } from "@/lib/projects"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  DashboardCard,
  RowChevron,
  WidgetEmpty,
  WidgetError,
  WidgetRowsSkeleton,
  WidgetStageChip,
  widgetRowClass,
} from "./dashboard-card"

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

function TaskRow({ task }: { task: MyTask }) {
  const overdue = isOverdue(task.dueDate)
  return (
    <Link
      to="/projects/$id/tasks/$taskId"
      params={{ id: task.projectId, taskId: task._id }}
      className={widgetRowClass}
    >
      <WidgetStageChip color={task.stageColor} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.projectTitle}
          {task.stageName ? <span className="text-muted-foreground/60"> · {task.stageName}</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {task.dueDate ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              overdue ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            {formatRelativeTime(task.dueDate)}
          </span>
        ) : null}
        <RowChevron />
      </div>
    </Link>
  )
}

export function TasksWidget() {
  const [tasks, setTasks] = useState<MyTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getMyTasks(6)
      .then((data) => {
        if (active) setTasks(data.tasks)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load tasks")
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <DashboardCard title="Tasks Assigned to Me" icon={ListChecksIcon} to="/projects" viewAllLabel="All Projects">
      {error ? (
        <WidgetError message={error} />
      ) : tasks === null ? (
        <WidgetRowsSkeleton rows={4} />
      ) : tasks.length === 0 ? (
        <WidgetEmpty
          icon={CheckCircle2Icon}
          title="No tasks assigned"
          description="Tasks assigned to you across projects will show up here."
        />
      ) : (
        <div className="flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task._id} task={task} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
