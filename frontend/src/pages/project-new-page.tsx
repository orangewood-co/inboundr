import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, FolderKanbanIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createProject,
  getProjectReferenceData,
  type ProjectEmployee,
  type ProjectReferenceData,
  type ProjectTeam,
  type ProjectVisibility,
} from "@/lib/projects"

type ProjectForm = {
  title: string
  description: string
  startDate: string
  dueDate: string
  visibility: ProjectVisibility
  visibleTeamIds: string[]
  memberIds: string[]
  managerIds: string[]
  followerIds: string[]
}

const initialForm: ProjectForm = {
  title: "",
  description: "",
  startDate: "",
  dueDate: "",
  visibility: "internal",
  visibleTeamIds: [],
  memberIds: [],
  managerIds: [],
  followerIds: [],
}

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked) return [...new Set([...values, value])]
  return values.filter((item) => item !== value)
}

function EmployeeChecklist({
  label,
  description,
  employees,
  value,
  onChange,
}: {
  label: string
  description: string
  employees: ProjectEmployee[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <Field>
      <div>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </div>
      <div className="grid max-h-64 gap-2 overflow-auto rounded-2xl border bg-muted/20 p-3 md:grid-cols-2">
        {employees.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">No active employees found.</p>
        ) : (
          employees.map((employee) => (
            <label key={employee._id} className="flex items-start gap-3 rounded-xl bg-background/80 p-3 text-sm">
              <Checkbox
                checked={value.includes(employee._id)}
                onCheckedChange={(checked) => onChange(toggleValue(value, employee._id, checked === true))}
              />
              <span>
                <span className="block font-medium">{employee.fullName}</span>
                <span className="block text-xs text-muted-foreground">{employee.email}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </Field>
  )
}

function TeamChecklist({
  teams,
  value,
  onChange,
}: {
  teams: ProjectTeam[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <Field>
      <div>
        <FieldLabel>Visible teams</FieldLabel>
        <FieldDescription>Users in these teams can open the project.</FieldDescription>
      </div>
      <div className="grid gap-2 rounded-2xl border bg-muted/20 p-3 md:grid-cols-2">
        {teams.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">No active teams found.</p>
        ) : (
          teams.map((team) => (
            <label key={team._id} className="flex items-center gap-3 rounded-xl bg-background/80 p-3 text-sm">
              <Checkbox
                checked={value.includes(team._id)}
                onCheckedChange={(checked) => onChange(toggleValue(value, team._id, checked === true))}
              />
              <span className="font-medium">{team.name}</span>
            </label>
          ))
        )}
      </div>
    </Field>
  )
}

export default function ProjectNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectForm>(initialForm)
  const [referenceData, setReferenceData] = useState<ProjectReferenceData>({ employees: [], teams: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getProjectReferenceData()
      .then(setReferenceData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load project reference data"))
  }, [])

  const selectedPeopleCount = useMemo(
    () => new Set([...form.memberIds, ...form.managerIds, ...form.followerIds]).size,
    [form.followerIds, form.managerIds, form.memberIds]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      toast.error("Project title is required")
      return
    }
    if (form.visibility === "teams" && form.visibleTeamIds.length === 0) {
      toast.error("Select at least one team for team visibility")
      return
    }
    setSaving(true)
    try {
      const detail = await createProject({
        title: form.title.trim(),
        description: form.description.trim() || null,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        visibility: form.visibility,
        visibleTeamIds: form.visibility === "teams" ? form.visibleTeamIds : [],
        memberIds: form.memberIds,
        managerIds: form.managerIds,
        followerIds: form.followerIds,
      })
      toast.success("Project created")
      void navigate({ to: "/projects/$id", params: { id: detail.project._id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: "New Project" },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => history.back()}>
            <ArrowLeftIcon />
            Back
          </Button>
        }
      />
      <main className="flex flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
          <section className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <FolderKanbanIcon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Create Project</p>
                <h1 className="text-3xl font-semibold tracking-tight">Set Up the Workspace</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Add project details, choose who can see it, and seed the people who should manage or follow it.
                </p>
              </div>
            </div>

            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="title">Project title</FieldLabel>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. Product launch"
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="What is this project trying to accomplish?"
                    className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="startDate">Start date</FieldLabel>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
                  <Input
                    id="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>Visibility</FieldLabel>
                <Select
                  value={form.visibility}
                  onValueChange={(visibility) =>
                    setForm((current) => ({ ...current, visibility: visibility as ProjectVisibility }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">All Internal Users</SelectItem>
                    <SelectItem value="private">Invited or Added Users</SelectItem>
                    <SelectItem value="teams">Respective Teams</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Private projects are limited to members, managers, and followers. Team projects can include multiple teams.
                </FieldDescription>
              </Field>

              {form.visibility === "teams" && (
                <TeamChecklist
                  teams={referenceData.teams}
                  value={form.visibleTeamIds}
                  onChange={(visibleTeamIds) => setForm((current) => ({ ...current, visibleTeamIds }))}
                />
              )}

              <EmployeeChecklist
                label="Project managers"
                description="Managers can edit metadata, visibility, followers, and stages."
                employees={referenceData.employees}
                value={form.managerIds}
                onChange={(managerIds) => setForm((current) => ({ ...current, managerIds }))}
              />
              <EmployeeChecklist
                label="Members"
                description="Members can work on tasks and will be able to access private projects."
                employees={referenceData.employees}
                value={form.memberIds}
                onChange={(memberIds) => setForm((current) => ({ ...current, memberIds }))}
              />
              <EmployeeChecklist
                label="Followers"
                description="Followers receive key email notifications and can view the activity log."
                employees={referenceData.employees}
                value={form.followerIds}
                onChange={(followerIds) => setForm((current) => ({ ...current, followerIds }))}
              />
            </FieldGroup>
          </section>

          <aside className="h-fit rounded-3xl border bg-muted/20 p-5">
            <h2 className="font-semibold">Project Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Visibility</span>
                <Badge variant="secondary">{form.visibility}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">People added</span>
                <span className="font-medium">{selectedPeopleCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Teams</span>
                <span className="font-medium">{form.visibility === "teams" ? form.visibleTeamIds.length : "-"}</span>
              </div>
            </div>
            <Button className="mt-6 w-full" type="submit" disabled={saving}>
              <SaveIcon />
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </aside>
        </form>
      </main>
    </AppLayout>
  )
}
