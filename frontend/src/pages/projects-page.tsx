import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  GlobeIcon,
  LockIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { DueDatePill, formatDate } from "@/components/projects/board-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listProjects, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

const PAGE_LIMIT = 24

const STATUS_TONE: Record<Project["status"], string> = {
  active: "bg-success/10 text-success",
  completed: "bg-info/10 text-info",
  archived: "bg-muted text-muted-foreground",
}

const VISIBILITY_LABELS: Record<Project["visibility"], string> = {
  internal: "All Internal Users",
  private: "Invited Users",
  teams: "Respective Teams",
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  const VisibilityIcon =
    project.visibility === "internal" ? GlobeIcon : project.visibility === "private" ? LockIcon : UsersIcon
  const memberCount = new Set([
    ...project.memberIds,
    ...project.managerIds,
    ...project.followerIds,
  ]).size

  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="group flex min-h-60 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg"
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <FolderKanbanIcon className="size-5" />
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              STATUS_TONE[project.status]
            )}
          >
            {project.status}
          </span>
        </div>
        <div className="mt-4 flex-1 space-y-1.5">
          <h3 className="line-clamp-2 text-lg font-semibold tracking-tight">{project.title}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description || "No description yet."}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
            <VisibilityIcon className="size-3" />
            {VISIBILITY_LABELS[project.visibility]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
            <UsersIcon className="size-3" />
            {memberCount}
          </span>
          {project.startDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDaysIcon className="size-3.5" />
              {formatDate(project.startDate)}
            </span>
          )}
          <DueDatePill due={project.dueDate} />
        </div>
      </div>
    </button>
  )
}

function ProjectSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border bg-card p-5">
          <div className="flex justify-between">
            <Skeleton className="size-11 rounded-2xl" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="mt-6 h-7 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-12 h-4 w-48" />
          <Skeleton className="mt-3 h-4 w-36" />
        </div>
      ))}
    </div>
  )
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects({ search, status, page: 1, limit: PAGE_LIMIT })
      setProjects(data.projects)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch projects")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchProjects(), 250)
    return () => window.clearTimeout(timeout)
  }, [fetchProjects])

  const emptyMessage = useMemo(() => {
    if (search.trim()) return "No projects matched your search."
    if (status !== "all") return `No ${status} projects yet.`
    return "Create the first project to start planning work."
  }, [search, status])

  return (
    <AppLayout>
      <SiteHeader
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true)
                void fetchProjects()
              }}
              disabled={refreshing}
            >
              <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void navigate({ to: "/projects/new" })}>
              <PlusIcon />
              New Project
            </Button>
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <div className="mb-6 flex justify-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 sm:w-72"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <ProjectSkeleton />
        ) : projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed bg-muted/20 p-12 text-center">
            <FolderKanbanIcon className="size-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No Projects Found</h2>
            <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
            <Button className="mt-5" onClick={() => void navigate({ to: "/projects/new" })}>
              <PlusIcon />
              New Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onOpen={(item) => void navigate({ to: "/projects/$id", params: { id: item._id } })}
              />
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  )
}
