import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, CirclePlusIcon, Code2Icon, CopyIcon, ExternalLinkIcon, GripVerticalIcon, MapPinIcon, PencilIcon, Share2Icon, Trash2Icon, UsersRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { ApplicationFormBuilder } from "@/components/recruitment/application-form-builder"
import { RecruitmentPageTitle, RecruitmentShell } from "@/components/recruitment/recruitment-shell"
import { RubricWorkflow } from "@/components/recruitment/rubric-workflow"
import { DatePicker } from "@/components/date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { getEmbedOrigin } from "@/lib/env"
import { useEntitlements } from "@/lib/entitlements"
import { JOB_TRANSITIONS, careersUrl, entity, initials, recruitmentApi, type Application, type JobStatus, type RecruitmentJob, type RecruitmentSettings, type RecruitmentStage } from "@/lib/recruitment"
import { cn } from "@/lib/utils"

const COLORS = ["#64748b", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"]
const DEFAULT_STAGES: RecruitmentStage[] = [
  { id: "applied", name: "Applied", order: 0, color: COLORS[0], isTerminal: false, terminalOutcome: null },
  { id: "screening", name: "Screening", order: 1, color: COLORS[1], isTerminal: false, terminalOutcome: null },
  { id: "interview", name: "Interview", order: 2, color: COLORS[2], isTerminal: false, terminalOutcome: null },
  { id: "offer", name: "Offer", order: 3, color: COLORS[3], isTerminal: false, terminalOutcome: null },
  { id: "hired", name: "Hired", order: 4, color: COLORS[4], isTerminal: true, terminalOutcome: "hired" },
  { id: "rejected", name: "Rejected", order: 5, color: COLORS[5], isTerminal: true, terminalOutcome: "rejected" },
]

type FormState = Pick<RecruitmentJob, "title" | "department" | "location" | "employmentType" | "workplaceType" | "description" | "requirements" | "openings" | "stages" | "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod" | "salaryVisible" | "publicSlug" | "seoTitle" | "seoDescription" | "socialShareText" | "applicationDeadline" | "publicApplicationForm">
const EMPTY: FormState = { title: "", department: "", location: "", employmentType: "Full Time", workplaceType: "hybrid", description: "", requirements: "", openings: 1, stages: DEFAULT_STAGES, salaryMin: null, salaryMax: null, salaryCurrency: "INR", salaryPeriod: "year", salaryVisible: false, publicSlug: null, seoTitle: "", seoDescription: "", socialShareText: "", applicationDeadline: null, publicApplicationForm: { schemaVersion: 1, fields: [] } }

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function PublicSharePanel({ job, organizationPath, onSaved, canManage }: { job: RecruitmentJob; organizationPath: string; onSaved: () => Promise<void>; canManage: boolean }) {
  const [socialCopy, setSocialCopy] = useState(job.socialShareText || `We're hiring a ${job.title}. Explore the role and apply today.`)
  const [department, setDepartment] = useState("")
  const [location, setLocation] = useState("")
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto")
  const [busy, setBusy] = useState("")
  const publicUrl = careersUrl(organizationPath, job.publicSlug)
  const snippet = `<div data-inboundr-recruitment data-organization="${escapeHtmlAttribute(organizationPath)}"${department ? ` data-department="${escapeHtmlAttribute(department)}"` : ""}${location ? ` data-location="${escapeHtmlAttribute(location)}"` : ""} data-theme="${escapeHtmlAttribute(theme)}"></div>\n<script async src="${escapeHtmlAttribute(getEmbedOrigin())}/recruitment-widget.js"></script>`
  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value)
    setBusy(label)
    window.setTimeout(() => setBusy(""), 1600)
  }
  async function share() {
    const payload = { title: job.title, text: socialCopy, url: publicUrl }
    if (navigator.share) {
      try { await navigator.share(payload); return } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    await copy(`${socialCopy}\n${publicUrl}`, "share")
    toast.success("Share copy copied")
  }
  async function saveCopy() {
    if (!canManage) return
    setBusy("save")
    try {
      await recruitmentApi.updateJob(job._id, { socialShareText: socialCopy })
      await onSaved()
      toast.success("Social copy saved")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save social copy") }
    finally { setBusy("") }
  }
  return <section className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-xs">
    <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Public distribution</p><h2 className="mt-1 font-semibold">Share this opening</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Open preview</a></Button><Button size="sm" onClick={() => void share()}><Share2Icon /> Share</Button></div></div>
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <div className="space-y-4"><div><Label>Hosted job URL</Label><div className="mt-2 flex gap-2"><Input readOnly value={publicUrl} /><Button size="icon" variant="outline" aria-label="Copy hosted job URL" onClick={() => void copy(publicUrl, "url")}>{busy === "url" ? <CheckIcon /> : <CopyIcon />}</Button></div></div><div><Label htmlFor="social-copy">Social copy</Label><textarea id="social-copy" maxLength={500} readOnly={!canManage} className="mt-2 min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={socialCopy} onChange={(event) => setSocialCopy(event.target.value)} /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{canManage ? `${socialCopy.length}/500 · generated from the job when left blank` : "Read-only: admin access is required to edit share copy."}</span>{canManage && <Button size="sm" variant="outline" disabled={busy === "save" || socialCopy === job.socialShareText} onClick={() => void saveCopy()}>{busy === "save" && <Spinner />} Save copy</Button>}</div></div></div>
      <div className="rounded-xl border bg-muted/30 p-4"><div className="flex items-center gap-2"><Code2Icon className="size-4" /><h3 className="text-sm font-semibold">Jobs widget</h3></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Paste once into any page. Organization is required; department, location, and theme are optional data attributes.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><Label className="text-xs">Department</Label><Input className="mt-1" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Engineering" /></div><div><Label className="text-xs">Location</Label><Input className="mt-1" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote" /></div><div><Label className="text-xs">Theme</Label><Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></div></div><pre className="mt-4 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-foreground p-3 text-[11px] leading-5 text-background">{snippet}</pre><Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => void copy(snippet, "snippet")}>{busy === "snippet" ? <CheckIcon /> : <CopyIcon />} {busy === "snippet" ? "Copied" : "Copy embed snippet"}</Button></div>
    </div>
  </section>
}

function slugStage(value: string) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "stage"}-${Date.now().toString(36)}`
}

function jobSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || null
}

function defaultSocialCopy(title: string) {
  return title.trim() ? `We're hiring a ${title.trim()}. Explore the role and apply today.` : ""
}

export function RecruitmentJobFormPage({ edit = false }: { edit?: boolean }) {
  const { canManageOrganization } = useEntitlements()
  const { jobId = "" } = useParams({ strict: false }) as { jobId?: string }
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(edit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null)
  useEffect(() => {
    void recruitmentApi.settings().then(({ settings: value }) => setSettings(value)).catch(() => undefined)
    if (!edit || !jobId) return
    void recruitmentApi.job(jobId).then(({ job }) => setForm({
      ...job,
      salaryPeriod: job.salaryPeriod ?? "year",
      seoTitle: job.seoTitle || job.title,
      seoDescription: job.seoDescription || job.description.slice(0, 320),
      socialShareText: job.socialShareText || defaultSocialCopy(job.title),
      applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : null,
      publicApplicationForm: { schemaVersion: 1, fields: job.publicApplicationForm?.fields ?? [] },
    })).catch((e) => setError(e instanceof Error ? e.message : "Unable to load job")).finally(() => setLoading(false))
  }, [edit, jobId])
  const updateStage = (index: number, update: Partial<RecruitmentStage>) => setForm((current) => ({ ...current, stages: current.stages.map((stage, i) => i === index ? { ...stage, ...update } : stage) }))
  const reorder = (index: number, direction: -1 | 1) => setForm((current) => {
    const stages = [...current.stages]; const target = index + direction
    if (target < 0 || target >= stages.length) return current
    ;[stages[index], stages[target]] = [stages[target], stages[index]]
    return { ...current, stages: stages.map((stage, order) => ({ ...stage, order })) }
  })
  function updateTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      publicSlug: !edit || !current.publicSlug || current.publicSlug === jobSlug(current.title)
        ? jobSlug(title)
        : current.publicSlug,
      seoTitle: !current.seoTitle || current.seoTitle === current.title ? title : current.seoTitle,
      socialShareText: !current.socialShareText || current.socialShareText === defaultSocialCopy(current.title)
        ? defaultSocialCopy(title)
        : current.socialShareText,
    }))
  }
  function updateDescription(description: string) {
    setForm((current) => ({
      ...current,
      description,
      seoDescription: !current.seoDescription || current.seoDescription === current.description.slice(0, 320)
        ? description.slice(0, 320)
        : current.seoDescription,
    }))
  }
  async function save() {
    if (!canManageOrganization) return
    if (!form.title.trim()) { toast.error("Job title is required"); return }
    if (form.salaryMin !== null && form.salaryMax !== null && form.salaryMax < form.salaryMin) { toast.error("Maximum salary cannot be lower than minimum salary"); return }
    const invalidField = form.publicApplicationForm.fields.find((field) => !field.label.trim() || ((field.type === "dropdown" || field.type === "checkbox") && !field.options.some((option) => option.trim())))
    if (invalidField) { toast.error("Every application question needs a label and choice fields need options"); return }
    const payload: FormState = {
      ...form,
      publicApplicationForm: {
        schemaVersion: 1,
        fields: form.publicApplicationForm.fields.map((field) => ({
          ...field,
          label: field.label.trim(),
          description: field.description?.trim() || null,
          options: field.options.map((option) => option.trim()).filter(Boolean),
          visibilityCondition: field.visibilityCondition
            ? { ...field.visibilityCondition, value: typeof field.visibilityCondition.value === "string" ? field.visibilityCondition.value.trim() : field.visibilityCondition.value }
            : null,
        })),
      },
    }
    setSaving(true)
    try {
      const result = edit ? await recruitmentApi.updateJob(jobId, payload) : await recruitmentApi.createJob(payload)
      toast.success(edit ? "Job updated" : "Draft job created")
      await navigate({ to: "/recruitment/jobs/$jobId", params: { jobId: result.job._id } })
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save job") } finally { setSaving(false) }
  }
  if (loading) return <RecruitmentShell><ListSkeleton rows={8} columns={2} /></RecruitmentShell>
  if (error) return <RecruitmentShell><ErrorState message={error} /></RecruitmentShell>
  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Jobs", href: "/recruitment/jobs" }, { label: edit ? "Edit" : "New" }]}>
      <div className="mx-auto max-w-5xl">
        <RecruitmentPageTitle title={edit ? "Edit Job" : "Create a Job"} description="Define the role and tune the pipeline to match how your team actually hires." />
        {!canManageOrganization && <p className="mb-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Read-only: organization admin access is required to create or change jobs, forms, stages, and rubrics.</p>}
        <fieldset disabled={!canManageOrganization} className="grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-xs"><h2 className="font-semibold">Role Details</h2><p className="mb-5 text-sm text-muted-foreground">The shared brief reviewers will use throughout this hire.</p>
              <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="title">Job title</Label><Input id="title" className="mt-2" value={form.title} onChange={(e) => updateTitle(e.target.value)} placeholder="Senior Product Designer" /></div>
                <div><Label>Department</Label><Input className="mt-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Product" /></div>
                <div><Label>Location</Label><Input className="mt-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bengaluru" /></div>
                <div><Label>Employment type</Label><Select value={form.employmentType} onValueChange={(employmentType) => setForm({ ...form, employmentType })}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full Time">Full Time</SelectItem><SelectItem value="Contract">Contract</SelectItem><SelectItem value="Intern">Intern</SelectItem></SelectContent></Select></div>
                <div><Label>Workplace</Label><Select value={form.workplaceType ?? "none"} onValueChange={(value) => setForm({ ...form, workplaceType: value === "none" ? null : value as FormState["workplaceType"] })}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="onsite">On-site</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="remote">Remote</SelectItem></SelectContent></Select></div>
                <div><Label>Openings</Label><Input type="number" min={1} max={10000} className="mt-2" value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} /></div>
                <DatePicker label="Application deadline" value={form.applicationDeadline ?? ""} onChange={(value) => setForm({ ...form, applicationDeadline: value || null })} placeholder="Select a deadline" />
                <div className="sm:col-span-2"><Label>Description</Label><textarea className="mt-2 min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={form.description} onChange={(e) => updateDescription(e.target.value)} placeholder="What this person will own and why the role matters…" /></div>
                <div className="sm:col-span-2"><Label>Requirements</Label><textarea className="mt-2 min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Experience, skills, and qualities…" /></div>
              </div>
            </section>
            {edit && jobId && <RubricWorkflow jobId={jobId} canManage={canManageOrganization} />}
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Compensation</h2><p className="mb-5 text-sm text-muted-foreground">Set the range and whether it is paid hourly, monthly, or annually.</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[120px_160px_1fr_1fr]">
                <div><Label>Currency</Label><Input className="mt-2 uppercase" maxLength={3} value={form.salaryCurrency} onChange={(event) => setForm({ ...form, salaryCurrency: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="INR" /></div>
                <div><Label>Pay period</Label><Select value={form.salaryPeriod} onValueChange={(salaryPeriod: FormState["salaryPeriod"]) => setForm({ ...form, salaryPeriod })}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hour">Per Hour</SelectItem><SelectItem value="month">Per Month</SelectItem><SelectItem value="year">Per Annum</SelectItem></SelectContent></Select></div>
                <div><Label>Minimum salary</Label><Input className="mt-2" type="number" min={0} value={form.salaryMin ?? ""} onChange={(event) => setForm({ ...form, salaryMin: event.target.value === "" ? null : event.target.valueAsNumber })} /></div>
                <div><Label>Maximum salary</Label><Input className="mt-2" type="number" min={0} value={form.salaryMax ?? ""} onChange={(event) => setForm({ ...form, salaryMax: event.target.value === "" ? null : event.target.valueAsNumber })} /></div>
              </div>
              <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-medium">Show salary publicly</span><span className="text-xs text-muted-foreground">Display this range on the careers listing and job page.</span></span><Switch checked={form.salaryVisible} onCheckedChange={(checked) => setForm({ ...form, salaryVisible: checked })} /></label>
            </section>
            <Collapsible className="group rounded-2xl border bg-card shadow-xs">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-4 p-6 text-left">
                  <span><span className="block font-semibold">Search & Sharing</span><span className="mt-1 block text-sm text-muted-foreground">Automatically prepared from the job title and description. Expand only when you want custom copy.</span></span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 border-t px-6 pt-5 pb-6">
                  <div><Label>SEO title</Label><Input className="mt-2" maxLength={120} value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} placeholder={form.title || "Job title"} /><p className="mt-1 text-right text-xs text-muted-foreground">{form.seoTitle.length}/120</p></div>
                  <div><Label>SEO description</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={320} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} placeholder="A concise description for search engines." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.seoDescription.length}/320</p></div>
                  <div><Label>Social share text</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={500} value={form.socialShareText} onChange={(event) => setForm({ ...form, socialShareText: event.target.value })} placeholder="A compelling message for shared links." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.socialShareText.length}/500</p></div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <ApplicationFormBuilder value={form.publicApplicationForm} onChange={(publicApplicationForm) => setForm({ ...form, publicApplicationForm })} />
            <section className="rounded-2xl border bg-card p-6 shadow-xs"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Hiring Stages</h2><p className="text-sm text-muted-foreground">Terminal stages set the application's final outcome.</p></div><Button variant="outline" size="sm" onClick={() => setForm({ ...form, stages: [...form.stages, { id: slugStage("stage"), name: "New stage", order: form.stages.length, color: COLORS[form.stages.length % COLORS.length], isTerminal: false, terminalOutcome: null }] })}><CirclePlusIcon /> Add Stage</Button></div>
              <div className="mt-5 space-y-2">{form.stages.map((stage, index) => <div key={stage.id} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[auto_1fr_150px_auto]"><GripVerticalIcon className="size-4 text-muted-foreground" /><Input value={stage.name} onChange={(e) => updateStage(index, { name: e.target.value })} /><Select value={stage.terminalOutcome ?? "active"} onValueChange={(value) => updateStage(index, { isTerminal: value !== "active", terminalOutcome: value === "active" ? null : value as "hired" | "rejected" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active stage</SelectItem><SelectItem value="hired">Hired outcome</SelectItem><SelectItem value="rejected">Rejected outcome</SelectItem></SelectContent></Select><div className="flex"><Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUpIcon /></Button><Button size="icon-sm" variant="ghost" disabled={index === form.stages.length - 1} onClick={() => reorder(index, 1)}><ArrowDownIcon /></Button><Button size="icon-sm" variant="ghost" disabled={form.stages.length <= 1} onClick={() => setForm({ ...form, stages: form.stages.filter((_, i) => i !== index).map((item, order) => ({ ...item, order })) })}><Trash2Icon /></Button></div></div>)}</div>
            </section>
          </div>
          <aside><div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-xs"><p className="text-sm font-semibold text-muted-foreground">Before Publishing</p><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li>• Choose a candidate deadline.</li><li>• Confirm every custom question and condition.</li><li>• Review salary visibility and social preview copy.</li></ul>{settings?.organizationPath && form.publicSlug && <Button className="mt-5 w-full" variant="outline" asChild><a href={careersUrl(settings.organizationPath, form.publicSlug)} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Public Preview</a></Button>}<div className="mt-3 grid gap-2"><Button onClick={() => void save()} disabled={saving}>{saving && <Spinner />} {edit ? "Save Changes" : "Create Draft"}</Button><Button variant="ghost" asChild><Link to={edit ? "/recruitment/jobs/$jobId" : "/recruitment/jobs"} params={edit ? { jobId } : {}}>Cancel</Link></Button></div></div></aside>
        </fieldset>
      </div>
    </RecruitmentShell>
  )
}

function PipelineCardContent({
  application,
  stages,
  busy,
  dragging = false,
  onMove,
  dragHandle,
}: {
  application: Application
  stages: RecruitmentStage[]
  busy: boolean
  dragging?: boolean
  onMove?: (stageId: string) => void
  dragHandle?: ReactNode
}) {
  const candidate = entity(application.candidateId)
  return (
    <article className={cn(
      "rounded-xl border bg-card p-4 shadow-xs transition-all",
      dragging ? "rotate-1 border-primary/40 shadow-xl" : "hover:border-border hover:shadow-sm",
    )}>
      <div className="flex items-start gap-3">
        {dragHandle}
        <Link to="/recruitment/applications/$applicationId" params={{ applicationId: application._id }} className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{initials(candidate?.fullName ?? "C")}</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{candidate?.fullName ?? "Candidate"}</p><p className="truncate text-xs text-muted-foreground">{candidate?.headline || candidate?.email}</p></div>
        </Link>
      </div>
      {onMove && <div className="mt-4"><Select value={application.stageId} disabled={busy} onValueChange={onMove}><SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{stages.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>}
    </article>
  )
}

function DraggablePipelineCard({
  application,
  stages,
  busy,
  onMove,
}: {
  application: Application
  stages: RecruitmentStage[]
  busy: boolean
  onMove: (stageId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application._id,
    data: { application },
    disabled: busy,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-20")}
    >
      <PipelineCardContent
        application={application}
        stages={stages}
        busy={busy}
        onMove={onMove}
        dragHandle={
          <button
            type="button"
            className="mt-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag ${entity(application.candidateId)?.fullName ?? "applicant"} to another stage`}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        }
      />
    </div>
  )
}

function PipelineColumn({
  stage,
  applications,
  stages,
  busyId,
  onMove,
}: {
  stage: RecruitmentStage
  applications: Application[]
  stages: RecruitmentStage[]
  busyId: string
  onMove: (application: Application, stageId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { stageId: stage.id } })
  return (
    <section className="w-[300px] shrink-0">
      <div className="mb-3 flex items-center gap-2 px-1"><span className="size-2.5 rounded-full" style={{ background: stage.color ?? "#64748b" }} /><h2 className="text-sm font-semibold">{stage.name}</h2><Badge variant="secondary" className="ml-auto">{applications.length}</Badge></div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-60 space-y-3 rounded-2xl border border-transparent bg-muted/70 p-2.5 transition-colors",
          isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/15",
        )}
      >
        {!applications.length
          ? <div className={cn("flex h-28 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground transition-colors", isOver && "border-primary/50 text-primary")}>{isOver ? `Drop in ${stage.name}` : "No applicants"}</div>
          : applications.map((application) => (
            <DraggablePipelineCard
              key={application._id}
              application={application}
              stages={stages}
              busy={busyId === application._id}
              onMove={(stageId) => onMove(application, stageId)}
            />
          ))}
      </div>
    </section>
  )
}

export function RecruitmentJobDetailPage() {
  const { canManageOrganization } = useEntitlements()
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  const [data, setData] = useState<Awaited<ReturnType<typeof recruitmentApi.pipeline>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [activeApplicationId, setActiveApplicationId] = useState("")
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const load = useCallback(async () => {
    setError("")
    try {
      const [pipeline, settingsResult] = await Promise.all([recruitmentApi.pipeline(jobId), recruitmentApi.settings()])
      setData(pipeline)
      setSettings(settingsResult.settings)
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load pipeline") }
    finally { setLoading(false) }
  }, [jobId])
  useEffect(() => {
    // Initial remote hydration is intentionally effect-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  async function move(application: Application, stageId: string) {
    if (application.stageId === stageId || busy) return
    const previous = data
    setBusy(application._id)
    setData((current) => {
      if (!current) return current
      const updated = { ...application, stageId }
      const applications = current.applications.map((item) => item._id === application._id ? updated : item)
      const byStage = Object.fromEntries(current.job.stages.map((stage) => [
        stage.id,
        applications.filter((item) => item.stageId === stage.id),
      ]))
      return { ...current, applications, byStage }
    })
    try {
      await recruitmentApi.moveApplication(application._id, stageId)
      toast.success(`Applicant moved to ${stages.find((stage) => stage.id === stageId)?.name ?? "the new stage"}`)
    } catch (e) {
      setData(previous)
      toast.error(e instanceof Error ? e.message : "Unable to move applicant")
    } finally {
      setBusy("")
    }
  }
  function handleDragStart(event: DragStartEvent) {
    setActiveApplicationId(String(event.active.id))
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveApplicationId("")
    const stageId = event.over?.data.current?.stageId as string | undefined
    const application = data?.applications.find((item) => item._id === String(event.active.id))
    if (stageId && application) void move(application, stageId)
  }
  async function transition(status: JobStatus) {
    if (!data || !canManageOrganization) return
    try { await recruitmentApi.changeJobStatus(jobId, status); await load(); toast.success(`Job is now ${status}`) } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to update job") }
  }
  const stages = [...(data?.job.stages ?? [])].sort((a, b) => a.order - b.order)
  const activeApplication = data?.applications.find((application) => application._id === activeApplicationId)
  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Jobs", href: "/recruitment/jobs" }, { label: data?.job.title ?? "Pipeline" }]}>
      {loading ? <ListSkeleton rows={8} columns={4} /> : error || !data ? <ErrorState message={error || "Job not found"} onRetry={() => void load()} /> : <>
        <RecruitmentPageTitle eyebrow={`${data.job.department || "Hiring"} · ${data.job.status}`} title={data.job.title} description={`${data.job.location || "Flexible location"} · ${data.job.employmentType || "Employment type not set"} · ${data.job.openings} opening${data.job.openings === 1 ? "" : "s"}`}
          action={canManageOrganization ? <div className="flex gap-2"><Button variant="outline" asChild><Link to="/recruitment/jobs/$jobId/edit" params={{ jobId }}><PencilIcon /> Edit</Link></Button>{JOB_TRANSITIONS[data.job.status].map((status) => <Button key={status} variant={status === "open" ? "default" : "outline"} className="capitalize" onClick={() => void transition(status)}>{status}</Button>)}</div> : undefined} />
        {!canManageOrganization && <p className="mb-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Read-only: organization admin access is required to change this job or its ranking rubric.</p>}
        {settings?.organizationPath && data.job.publicSlug && <PublicSharePanel key={`${data.job._id}:${data.job.socialShareText}`} job={data.job} organizationPath={settings.organizationPath} onSaved={load} canManage={canManageOrganization} />}
        <RubricWorkflow jobId={jobId} className="mb-6" canManage={canManageOrganization} />
        <div className="mb-5 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"><MapPinIcon className="size-4" /><span>Drag applicants between stages or use the stage menu on each card. Every move is recorded in activity.</span></div>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragCancel={() => setActiveApplicationId("")} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-5">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                applications={data.byStage[stage.id] ?? []}
                stages={stages}
                busyId={busy}
                onMove={(application, stageId) => void move(application, stageId)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {activeApplication ? <div className="w-[280px]"><PipelineCardContent application={activeApplication} stages={stages} busy={false} dragging /></div> : null}
          </DragOverlay>
        </DndContext>
        {!data.applications.length && <EmptyState icon={UsersRoundIcon} title="The pipeline is ready" description="Applications added to this job will appear in the first active stage." />}
      </>}
    </RecruitmentShell>
  )
}
