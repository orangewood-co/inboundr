import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CalendarCheckIcon,
  IdCardIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { EmptyState, ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { EmployeeAccessModule } from "@/lib/entitlements"
import { resolveUploadedImageUrl } from "@/lib/uploaded-image"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/employees`
const PAGE_LIMIT = 24

type EmployeeStatus = "active" | "inactive" | "terminated" | "archived"

interface EmployeeTeam {
  _id: string
  name: string
  description: string | null
  defaultModules: EmployeeAccessModule[]
  employeeCount?: number
}

interface Employee {
  _id: string
  teamId: string | null
  team: EmployeeTeam | null
  employeeCode: string | null
  fullName: string
  email: string
  phone: string | null
  title: string | null
  profileImageUrl: string | null
  status: EmployeeStatus
  startDate: string | null
  emergencyContact: {
    name: string
    relationship: string
    phone: string
    email: string
  }
  platformAccess: {
    enabled: boolean
    allowedModules: EmployeeAccessModule[]
    restrictedModules: EmployeeAccessModule[]
    invitedEmail: string | null
    lastInvitedAt: string | null
  }
  createdAt: string
  updatedAt: string
}

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  terminated: "Terminated",
  archived: "Archived",
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IN"
}

function EmployeeAvatarImage({ source }: { source: string | null }) {
  const [displayUrl, setDisplayUrl] = useState("")

  useEffect(() => {
    let cancelled = false
    const value = source?.trim() ?? ""
    if (!value) {
      setDisplayUrl("")
      return
    }

    void resolveUploadedImageUrl(value)
      .then((url) => {
        if (!cancelled) setDisplayUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDisplayUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [source])

  return <AvatarImage src={displayUrl || undefined} />
}

function toggleModule(
  modules: EmployeeAccessModule[],
  module: EmployeeAccessModule,
  checked: boolean
) {
  if (checked) return [...new Set([...modules, module])]
  return modules.filter((item) => item !== module)
}

function ModuleChecklist({
  modules,
  value,
  onChange,
}: {
  modules: { key: EmployeeAccessModule; label: string }[]
  value: EmployeeAccessModule[]
  onChange: (modules: EmployeeAccessModule[]) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {modules.map((module) => (
        <label
          key={module.key}
          className="flex items-center gap-2 rounded-xl border bg-background/60 px-3 py-2 text-sm"
        >
          <Checkbox
            checked={value.includes(module.key)}
            onCheckedChange={(checked) => onChange(toggleModule(value, module.key, checked === true))}
          />
          <span>{module.label}</span>
        </label>
      ))}
    </div>
  )
}

function DirectorySkeleton() {
  return (
    <div className="grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex min-h-56 flex-col items-center justify-center rounded-xl border bg-card p-6">
          <Skeleton className="size-28 rounded-full" />
          <div className="mt-6 flex w-full flex-col items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teams, setTeams] = useState<EmployeeTeam[]>([])
  const [modules, setModules] = useState<{ key: EmployeeAccessModule; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [teamModules, setTeamModules] = useState<EmployeeAccessModule[]>([])

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: "1", limit: String(PAGE_LIMIT) })
      if (search.trim()) params.set("search", search.trim())
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (teamFilter !== "all") params.set("teamId", teamFilter)
      const response = await fetch(`${API_BASE}?${params}`, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch employees")
      const data = await response.json()
      setEmployees(data.employees ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, teamFilter])

  const fetchReferenceData = useCallback(async () => {
    const [teamsResponse, modulesResponse] = await Promise.all([
      fetch(`${API_BASE}/teams`, { credentials: "include" }),
      fetch(`${API_BASE}/modules`, { credentials: "include" }),
    ])
    if (teamsResponse.ok) {
      const data = await teamsResponse.json()
      setTeams(data.teams ?? [])
    }
    if (modulesResponse.ok) {
      const data = await modulesResponse.json()
      setModules(data.modules ?? [])
    }
  }, [])

  useEffect(() => {
    void fetchReferenceData()
  }, [fetchReferenceData])

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchEmployees(), 250)
    return () => window.clearTimeout(timeout)
  }, [fetchEmployees])

  function openCreate() {
    void navigate({ to: "/employees/new" })
  }

  function openEmployee(employee: Employee) {
    void navigate({ to: "/employees/$id", params: { id: employee._id } })
  }

  async function createTeam() {
    if (!teamName.trim()) {
      toast.error("Team name is required")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          defaultModules: teamModules,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to create team")
      toast.success("Team created")
      setTeamName("")
      setTeamDescription("")
      setTeamModules([])
      await fetchReferenceData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team")
    } finally {
      setSaving(false)
    }
  }

  async function archiveTeam(teamId: string) {
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/teams/${teamId}/archive`, {
        method: "PATCH",
        credentials: "include",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to archive team")
      toast.success("Team archived")
      await fetchReferenceData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive team")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Employees" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => void navigate({ to: "/employees/attendance" })}>
              <CalendarCheckIcon />
              Attendance
            </Button>
            <Button variant="outline" onClick={() => setTeamsOpen(true)}>
              <UsersIcon />
              Teams
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon />
              New Employee
            </Button>
          </>
        }
      />
      <main className="flex-1 overflow-auto bg-muted/20 p-5 md:p-8">
        <section className="mx-auto mb-8 flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold tracking-tight">
            {employees.length} {employees.length === 1 ? "Employee" : "Employees"}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-72">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full border-transparent bg-background pl-9 shadow-none"
              placeholder="Search employees"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full border-transparent bg-transparent shadow-none md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-9 w-full border-transparent bg-transparent shadow-none md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => void fetchEmployees()}>
              <RefreshCwIcon />
            </Button>
          </div>
        </section>

        {loading ? (
          <DirectorySkeleton />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void fetchEmployees()}
            className="mx-auto max-w-7xl rounded-xl border bg-card p-12"
          />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={IdCardIcon}
            title="No Employees Found"
            description="Add the first profile or adjust your filters."
            action={
              <Button size="sm" onClick={openCreate}>
                <PlusIcon className="size-4" />
                New Employee
              </Button>
            }
            className="mx-auto max-w-7xl rounded-xl border bg-card"
          />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employees.map((employee) => (
              <button
                key={employee._id}
                type="button"
                onClick={() => openEmployee(employee)}
                className="relative flex min-h-56 flex-col items-center justify-center rounded-xl border bg-card p-6 text-center shadow-xs transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "absolute top-4 right-4 size-2 rounded-full",
                    employee.status === "active" ? "bg-success" : "bg-muted-foreground/40"
                  )}
                />
                <Avatar className="size-28 rounded-full" size="lg">
                  <EmployeeAvatarImage source={employee.profileImageUrl} />
                  <AvatarFallback className="rounded-full text-4xl font-semibold">{initials(employee.fullName)}</AvatarFallback>
                </Avatar>
                <div className="mt-6 min-w-0">
                  <h2 className="truncate text-base font-semibold">{employee.fullName}</h2>
                  <p className="mt-1 truncate text-sm text-foreground/80">{employee.title || "No title"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{employee.team?.name ?? "No team"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog open={teamsOpen} onOpenChange={setTeamsOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Teams</DialogTitle>
            <DialogDescription>Flat groups for employee organization and default module access.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="rounded-3xl border bg-muted/20 p-4">
              <div className="grid gap-3">
                <Input placeholder="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
                <Input placeholder="Description" value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} />
                <ModuleChecklist modules={modules} value={teamModules} onChange={setTeamModules} />
              </div>
              <Button className="mt-4" onClick={createTeam} disabled={saving}>
                <PlusIcon />
                Create Team
              </Button>
            </div>
            <div className="grid gap-3">
              {teams.map((team) => (
                <div key={team._id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">{team.description || "No description"} · {team.employeeCount ?? 0} employees</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn((team.employeeCount ?? 0) > 0 && "opacity-50")}
                      onClick={() => archiveTeam(team._id)}
                      disabled={saving || (team.employeeCount ?? 0) > 0}
                    >
                      Archive
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {team.defaultModules.length > 0 ? team.defaultModules.map((module) => (
                      <Badge key={module} variant="secondary">{modules.find((item) => item.key === module)?.label ?? module}</Badge>
                    )) : <span className="text-sm text-muted-foreground">No default module access</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
