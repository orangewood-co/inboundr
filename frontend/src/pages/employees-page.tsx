import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  IdCardIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { EmployeeAccessModule } from "@/lib/entitlements"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
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

type EmployeeFormState = {
  fullName: string
  email: string
  phone: string
  title: string
  employeeCode: string
  profileImageUrl: string
  teamId: string
  status: EmployeeStatus
  startDate: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  emergencyEmail: string
  accessEnabled: boolean
  allowedModules: EmployeeAccessModule[]
}

const emptyEmployeeForm: EmployeeFormState = {
  fullName: "",
  email: "",
  phone: "",
  title: "",
  employeeCode: "",
  profileImageUrl: "",
  teamId: "none",
  status: "active",
  startDate: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  accessEnabled: false,
  allowedModules: [],
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

function employeeToForm(employee: Employee): EmployeeFormState {
  return {
    fullName: employee.fullName ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    title: employee.title ?? "",
    employeeCode: employee.employeeCode ?? "",
    profileImageUrl: employee.profileImageUrl ?? "",
    teamId: employee.teamId ?? "none",
    status: employee.status ?? "active",
    startDate: employee.startDate ? employee.startDate.slice(0, 10) : "",
    emergencyName: employee.emergencyContact?.name ?? "",
    emergencyRelationship: employee.emergencyContact?.relationship ?? "",
    emergencyPhone: employee.emergencyContact?.phone ?? "",
    emergencyEmail: employee.emergencyContact?.email ?? "",
    accessEnabled: employee.platformAccess?.enabled ?? false,
    allowedModules: employee.platformAccess?.allowedModules ?? [],
  }
}

function formToPayload(form: EmployeeFormState) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim() || null,
    title: form.title.trim() || null,
    employeeCode: form.employeeCode.trim() || null,
    profileImageUrl: form.profileImageUrl.trim() || null,
    teamId: form.teamId === "none" ? null : form.teamId,
    status: form.status,
    startDate: form.startDate || null,
    emergencyContact: {
      name: form.emergencyName.trim(),
      relationship: form.emergencyRelationship.trim(),
      phone: form.emergencyPhone.trim(),
      email: form.emergencyEmail.trim().toLowerCase(),
    },
    platformAccess: {
      enabled: form.accessEnabled,
      allowedModules: form.allowedModules,
      restrictedModules: [],
    },
  }
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

function EmployeeForm({
  form,
  teams,
  modules,
  onChange,
}: {
  form: EmployeeFormState
  teams: EmployeeTeam[]
  modules: { key: EmployeeAccessModule; label: string }[]
  onChange: <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => void
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={form.fullName} onChange={(event) => onChange("fullName", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(event) => onChange("title", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Employee ID</Label>
          <Input value={form.employeeCode} onChange={(event) => onChange("employeeCode", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Start date</Label>
          <Input type="date" value={form.startDate} onChange={(event) => onChange("startDate", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(value) => onChange("status", value as EmployeeStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-2">
          <Label>Team</Label>
          <Select value={form.teamId} onValueChange={(value) => onChange("teamId", value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Profile image URL</Label>
          <Input value={form.profileImageUrl} onChange={(event) => onChange("profileImageUrl", event.target.value)} />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Emergency contact</h3>
          <p className="text-sm text-muted-foreground">Kept lightweight for directory and document workflows.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Name" value={form.emergencyName} onChange={(event) => onChange("emergencyName", event.target.value)} />
          <Input placeholder="Relationship" value={form.emergencyRelationship} onChange={(event) => onChange("emergencyRelationship", event.target.value)} />
          <Input placeholder="Phone" value={form.emergencyPhone} onChange={(event) => onChange("emergencyPhone", event.target.value)} />
          <Input placeholder="Email" value={form.emergencyEmail} onChange={(event) => onChange("emergencyEmail", event.target.value)} />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <label className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4">
          <Checkbox
            checked={form.accessEnabled}
            onCheckedChange={(checked) => onChange("accessEnabled", checked === true)}
          />
          <span>
            <span className="block text-sm font-semibold">Enable Inboundr access</span>
            <span className="block text-sm text-muted-foreground">Only linked or invited employees can use these module permissions.</span>
          </span>
        </label>
        <ModuleChecklist
          modules={modules}
          value={form.allowedModules}
          onChange={(value) => onChange("allowedModules", value)}
        />
      </div>
    </div>
  )
}

function DirectorySkeleton() {
  return (
    <div className="grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex min-h-56 flex-col items-center justify-center rounded-sm border bg-card p-6">
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
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EmployeeFormState>(emptyEmployeeForm)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [teamModules, setTeamModules] = useState<EmployeeAccessModule[]>([])

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
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
      toast.error(err instanceof Error ? err.message : "Failed to fetch employees")
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

  function updateForm<K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setForm(emptyEmployeeForm)
    setCreateOpen(true)
  }

  function openEmployee(employee: Employee) {
    void navigate({ to: "/employees/$id", params: { id: employee._id } })
  }

  async function saveEmployee() {
    const payload = formToPayload(form)
    if (!payload.fullName || !payload.email) {
      toast.error("Name and email are required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to save employee")
      toast.success("Employee added")
      setCreateOpen(false)
      await fetchEmployees()
      await fetchReferenceData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employee")
    } finally {
      setSaving(false)
    }
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
            <Button variant="outline" onClick={() => setTeamsOpen(true)}>
              <UsersIcon />
              Teams
            </Button>
            <Button onClick={openCreate}>
              <PlusIcon />
              Add employee
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
                <SelectItem value="all">All statuses</SelectItem>
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
                <SelectItem value="all">All teams</SelectItem>
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
        ) : employees.length === 0 ? (
          <div className="mx-auto max-w-7xl rounded-sm border bg-card p-12 text-center">
            <IdCardIcon className="mx-auto mb-3 size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No employees found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the first profile or adjust your filters.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employees.map((employee) => (
              <button
                key={employee._id}
                type="button"
                onClick={() => openEmployee(employee)}
                className="relative flex min-h-56 flex-col items-center justify-center rounded-sm border bg-card p-6 text-center shadow-xs"
              >
                <span
                  className={cn(
                    "absolute top-4 right-4 size-2 rounded-full",
                    employee.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                <Avatar className="size-28 rounded-full" size="lg">
                  <AvatarImage src={employee.profileImageUrl ?? undefined} />
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Add employee</SheetTitle>
            <SheetDescription>Create a directory record first; login access can be linked or invited later.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <EmployeeForm form={form} teams={teams} modules={modules} onChange={updateForm} />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={saveEmployee} disabled={saving}>Save employee</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
                Create team
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
