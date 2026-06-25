import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CalendarCheckIcon,
  FilterIcon,
  IdCardIcon,
  MailIcon,
  PhoneIcon,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

async function copyContact(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`)
  }
}

function EmployeeAvatarImage({ source }: { source: string | null }) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const value = source?.trim() ?? ""

  useEffect(() => {
    if (!value) return
    let cancelled = false

    void resolveUploadedImageUrl(value)
      .then((url) => {
        if (!cancelled) setDisplayUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDisplayUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [value])

  if (!displayUrl) return null

  return <AvatarImage src={displayUrl} className="rounded-2xl" />
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
    <div className="mx-auto grid max-w-[96rem] gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 rounded-xl border bg-card p-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-3 w-40" />
            <Skeleton className="h-3 w-32" />
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

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (teamFilter !== "all" ? 1 : 0)

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
        <section className="mx-auto mb-8 flex max-w-[96rem] flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9">
                    <FilterIcon />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-1 size-5 justify-center rounded-full px-0 tabular-nums">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64">
                  <div className="grid gap-4">
                    <div className="grid gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Status</span>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Team</span>
                      <Select value={teamFilter} onValueChange={setTeamFilter}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Teams</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-self-start px-2"
                        onClick={() => {
                          setStatusFilter("all")
                          setTeamFilter("all")
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={() => void fetchEmployees()}>
                <RefreshCwIcon />
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <DirectorySkeleton />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => void fetchEmployees()}
            className="mx-auto max-w-[96rem] rounded-xl border bg-card p-12"
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
            className="mx-auto max-w-[96rem] rounded-xl border bg-card"
          />
        ) : (
          <div className="mx-auto grid max-w-[96rem] gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
            {employees.map((employee) => {
              const phone = employee.phone
              return (
                <div
                  key={employee._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEmployee(employee)}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault()
                      openEmployee(employee)
                    }
                  }}
                  className="relative flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {employee.employeeCode && (
                    <span className="absolute top-3 right-3 font-mono text-xs text-muted-foreground">
                      {employee.employeeCode}
                    </span>
                  )}
                  <Avatar className="size-16 rounded-2xl after:rounded-2xl">
                    <EmployeeAvatarImage
                      key={employee.profileImageUrl ?? "empty"}
                      source={employee.profileImageUrl}
                    />
                    <AvatarFallback className="rounded-2xl text-lg font-semibold">{initials(employee.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate pr-14 font-semibold">{employee.fullName}</h2>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{employee.title || "No title"}</p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      <button
                        type="button"
                        title="Copy email"
                        onClick={(event) => {
                          event.stopPropagation()
                          void copyContact(employee.email, "Email")
                        }}
                        className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <MailIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{employee.email}</span>
                      </button>
                      {phone ? (
                        <button
                          type="button"
                          title="Copy phone number"
                          onClick={(event) => {
                            event.stopPropagation()
                            void copyContact(phone, "Phone")
                          }}
                          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <PhoneIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{phone}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
                          <PhoneIcon className="size-3.5 shrink-0" />
                          <span>—</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
              {teams.map((team) => {
                const visibleDefaultModules = team.defaultModules.flatMap((module) => {
                  const match = modules.find((item) => item.key === module)
                  return match ? [match] : []
                })

                return (
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
                      {visibleDefaultModules.length > 0 ? visibleDefaultModules.map((module) => (
                        <Badge key={module.key} variant="secondary">{module.label}</Badge>
                      )) : <span className="text-sm text-muted-foreground">No default module access</span>}
                    </div>
                  </div>
                )
              })}
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
