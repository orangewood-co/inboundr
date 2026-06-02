import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
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

const visibilityLabels: Record<Project["visibility"], string> = {
  internal: "All internal users",
  private: "Invited users",
  teams: "Teams",
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="group flex min-h-64 flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <FolderKanbanIcon className="size-5" />
        </div>
        <Badge variant={project.status === "completed" ? "default" : "secondary"}>
          {project.status}
        </Badge>
      </div>
      <div className="mt-5 flex-1 space-y-2">
        <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">{project.title}</h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {project.description || "No description yet."}
        </p>
      </div>
      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4" />
          <span>
            {formatDate(project.startDate)} - {formatDate(project.dueDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4" />
          <span>{visibilityLabels[project.visibility]}</span>
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
              New project
            </Button>
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Projects</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Plan, assign, and track work</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Build project boards with private, team, or internal visibility and switch from Kanban to schedule planning.
            </p>
          </div>
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
                <SelectItem value="all">All statuses</SelectItem>
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
            <h2 className="mt-4 text-lg font-semibold">No projects found</h2>
            <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
            <Button className="mt-5" onClick={() => void navigate({ to: "/projects/new" })}>
              <PlusIcon />
              Create project
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
