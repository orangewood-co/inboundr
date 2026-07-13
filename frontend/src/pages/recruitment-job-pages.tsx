import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CirclePlusIcon, Code2Icon, CopyIcon, ExternalLinkIcon, GripVerticalIcon, MapPinIcon, PencilIcon, Share2Icon, Trash2Icon, UsersRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { ApplicationFormBuilder } from "@/components/recruitment/application-form-builder"
import { RecruitmentPageTitle, RecruitmentShell } from "@/components/recruitment/recruitment-shell"
import { RubricWorkflow } from "@/components/recruitment/rubric-workflow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { getEmbedOrigin } from "@/lib/env"
import { useEntitlements } from "@/lib/entitlements"
import { JOB_TRANSITIONS, careersUrl, entity, initials, recruitmentApi, type Application, type JobStatus, type RecruitmentJob, type RecruitmentSettings, type RecruitmentStage } from "@/lib/recruitment"

const COLORS = ["#64748b", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"]
const DEFAULT_STAGES: RecruitmentStage[] = [
  { id: "applied", name: "Applied", order: 0, color: COLORS[0], isTerminal: false, terminalOutcome: null },
  { id: "screening", name: "Screening", order: 1, color: COLORS[1], isTerminal: false, terminalOutcome: null },
  { id: "interview", name: "Interview", order: 2, color: COLORS[2], isTerminal: false, terminalOutcome: null },
  { id: "offer", name: "Offer", order: 3, color: COLORS[3], isTerminal: false, terminalOutcome: null },
  { id: "hired", name: "Hired", order: 4, color: COLORS[4], isTerminal: true, terminalOutcome: "hired" },
  { id: "rejected", name: "Rejected", order: 5, color: COLORS[5], isTerminal: true, terminalOutcome: "rejected" },
]

type FormState = Pick<RecruitmentJob, "title" | "department" | "location" | "employmentType" | "workplaceType" | "description" | "requirements" | "openings" | "stages" | "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryVisible" | "publicSlug" | "seoTitle" | "seoDescription" | "socialShareText" | "applicationDeadline" | "publicApplicationForm">
const EMPTY: FormState = { title: "", department: "", location: "", employmentType: "Full-time", workplaceType: "hybrid", description: "", requirements: "", openings: 1, stages: DEFAULT_STAGES, salaryMin: null, salaryMax: null, salaryCurrency: "INR", salaryVisible: false, publicSlug: null, seoTitle: "", seoDescription: "", socialShareText: "", applicationDeadline: null, publicApplicationForm: { schemaVersion: 1, fields: [] } }

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
    void recruitmentApi.job(jobId).then(({ job }) => setForm({ ...job, applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : null, publicApplicationForm: { schemaVersion: 1, fields: job.publicApplicationForm?.fields ?? [] } })).catch((e) => setError(e instanceof Error ? e.message : "Unable to load job")).finally(() => setLoading(false))
  }, [edit, jobId])
  const updateStage = (index: number, update: Partial<RecruitmentStage>) => setForm((current) => ({ ...current, stages: current.stages.map((stage, i) => i === index ? { ...stage, ...update } : stage) }))
  const reorder = (index: number, direction: -1 | 1) => setForm((current) => {
    const stages = [...current.stages]; const target = index + direction
    if (target < 0 || target >= stages.length) return current
    ;[stages[index], stages[target]] = [stages[target], stages[index]]
    return { ...current, stages: stages.map((stage, order) => ({ ...stage, order })) }
  })
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
        <RecruitmentPageTitle title={edit ? "Edit job" : "Create a job"} description="Define the role and tune the pipeline to match how your team actually hires." />
        {!canManageOrganization && <p className="mb-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Read-only: organization admin access is required to create or change jobs, forms, stages, and rubrics.</p>}
        <fieldset disabled={!canManageOrganization} className="grid gap-6 lg:grid-cols-[1fr_330px]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-xs"><h2 className="font-semibold">Role details</h2><p className="mb-5 text-sm text-muted-foreground">The shared brief reviewers will use throughout this hire.</p>
              <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="title">Job title</Label><Input id="title" className="mt-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Product Designer" /></div>
                <div><Label>Department</Label><Input className="mt-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Product" /></div>
                <div><Label>Location</Label><Input className="mt-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Bengaluru" /></div>
                <div><Label>Employment type</Label><Input className="mt-2" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} /></div>
                <div><Label>Workplace</Label><Select value={form.workplaceType ?? "none"} onValueChange={(value) => setForm({ ...form, workplaceType: value === "none" ? null : value as FormState["workplaceType"] })}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem><SelectItem value="onsite">On-site</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="remote">Remote</SelectItem></SelectContent></Select></div>
                <div><Label>Openings</Label><Input type="number" min={1} max={10000} className="mt-2" value={form.openings} onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })} /></div>
                <div><Label>Public slug</Label><Input className="mt-2" value={form.publicSlug ?? ""} onChange={(e) => setForm({ ...form, publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || null })} placeholder="senior-product-designer" /></div>
                <div><Label>Application deadline</Label><Input type="date" className="mt-2" value={form.applicationDeadline ?? ""} onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value || null })} /></div>
                <div className="sm:col-span-2"><Label>Description</Label><textarea className="mt-2 min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this person will own and why the role matters…" /></div>
                <div className="sm:col-span-2"><Label>Requirements</Label><textarea className="mt-2 min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Experience, skills, and qualities…" /></div>
              </div>
            </section>
            {edit && jobId && <RubricWorkflow jobId={jobId} canManage={canManageOrganization} />}
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Compensation</h2><p className="mb-5 text-sm text-muted-foreground">Salary is only returned by the public API when visibility is enabled.</p>
              <div className="grid gap-4 sm:grid-cols-[120px_1fr_1fr]">
                <div><Label>Currency</Label><Input className="mt-2 uppercase" maxLength={3} value={form.salaryCurrency} onChange={(event) => setForm({ ...form, salaryCurrency: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="INR" /></div>
                <div><Label>Minimum salary</Label><Input className="mt-2" type="number" min={0} value={form.salaryMin ?? ""} onChange={(event) => setForm({ ...form, salaryMin: event.target.value === "" ? null : event.target.valueAsNumber })} /></div>
                <div><Label>Maximum salary</Label><Input className="mt-2" type="number" min={0} value={form.salaryMax ?? ""} onChange={(event) => setForm({ ...form, salaryMax: event.target.value === "" ? null : event.target.valueAsNumber })} /></div>
              </div>
              <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-medium">Show salary publicly</span><span className="text-xs text-muted-foreground">Display this range on the careers listing and job page.</span></span><Switch checked={form.salaryVisible} onCheckedChange={(checked) => setForm({ ...form, salaryVisible: checked })} /></label>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Search & sharing</h2><p className="mb-5 text-sm text-muted-foreground">Leave fields blank to use the job title and description automatically.</p>
              <div className="grid gap-4">
                <div><Label>SEO title</Label><Input className="mt-2" maxLength={120} value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} placeholder={form.title || "Job title"} /><p className="mt-1 text-right text-xs text-muted-foreground">{form.seoTitle.length}/120</p></div>
                <div><Label>SEO description</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={320} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} placeholder="A concise description for search engines." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.seoDescription.length}/320</p></div>
                <div><Label>Social share text</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={500} value={form.socialShareText} onChange={(event) => setForm({ ...form, socialShareText: event.target.value })} placeholder="A compelling message for shared links." /><p className="mt-1 text-right text-xs text-muted-foreground">{form.socialShareText.length}/500</p></div>
              </div>
            </section>
            <ApplicationFormBuilder value={form.publicApplicationForm} onChange={(publicApplicationForm) => setForm({ ...form, publicApplicationForm })} />
            <section className="rounded-2xl border bg-card p-6 shadow-xs"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Hiring stages</h2><p className="text-sm text-muted-foreground">Terminal stages set the application's final outcome.</p></div><Button variant="outline" size="sm" onClick={() => setForm({ ...form, stages: [...form.stages, { id: slugStage("stage"), name: "New stage", order: form.stages.length, color: COLORS[form.stages.length % COLORS.length], isTerminal: false, terminalOutcome: null }] })}><CirclePlusIcon /> Add stage</Button></div>
              <div className="mt-5 space-y-2">{form.stages.map((stage, index) => <div key={stage.id} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[auto_1fr_150px_auto]"><GripVerticalIcon className="size-4 text-muted-foreground" /><Input value={stage.name} onChange={(e) => updateStage(index, { name: e.target.value })} /><Select value={stage.terminalOutcome ?? "active"} onValueChange={(value) => updateStage(index, { isTerminal: value !== "active", terminalOutcome: value === "active" ? null : value as "hired" | "rejected" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active stage</SelectItem><SelectItem value="hired">Hired outcome</SelectItem><SelectItem value="rejected">Rejected outcome</SelectItem></SelectContent></Select><div className="flex"><Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUpIcon /></Button><Button size="icon-sm" variant="ghost" disabled={index === form.stages.length - 1} onClick={() => reorder(index, 1)}><ArrowDownIcon /></Button><Button size="icon-sm" variant="ghost" disabled={form.stages.length <= 1} onClick={() => setForm({ ...form, stages: form.stages.filter((_, i) => i !== index).map((item, order) => ({ ...item, order })) })}><Trash2Icon /></Button></div></div>)}</div>
            </section>
          </div>
          <aside><div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-xs"><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Before publishing</p><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li>• Set a public slug and candidate deadline.</li><li>• Confirm every custom question and condition.</li><li>• Review salary visibility and social preview copy.</li></ul>{settings?.organizationPath && form.publicSlug && <Button className="mt-5 w-full" variant="outline" asChild><a href={careersUrl(settings.organizationPath, form.publicSlug)} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Public preview</a></Button>}<div className="mt-3 grid gap-2"><Button onClick={() => void save()} disabled={saving}>{saving && <Spinner />} {edit ? "Save changes" : "Create draft"}</Button><Button variant="ghost" asChild><Link to={edit ? "/recruitment/jobs/$jobId" : "/recruitment/jobs"} params={edit ? { jobId } : {}}>Cancel</Link></Button></div></div></aside>
        </fieldset>
      </div>
    </RecruitmentShell>
  )
}

export function RecruitmentJobDetailPage() {
  const { canManageOrganization } = useEntitlements()
  const { jobId } = useParams({ strict: false }) as { jobId: string }
  const [data, setData] = useState<Awaited<ReturnType<typeof recruitmentApi.pipeline>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null)
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
    setBusy(application._id)
    try { await recruitmentApi.moveApplication(application._id, stageId); await load(); toast.success("Applicant moved") }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to move applicant") } finally { setBusy("") }
  }
  async function transition(status: JobStatus) {
    if (!data || !canManageOrganization) return
    try { await recruitmentApi.changeJobStatus(jobId, status); await load(); toast.success(`Job is now ${status}`) } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to update job") }
  }
  const stages = useMemo(() => [...(data?.job.stages ?? [])].sort((a, b) => a.order - b.order), [data])
  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Jobs", href: "/recruitment/jobs" }, { label: data?.job.title ?? "Pipeline" }]}>
      {loading ? <ListSkeleton rows={8} columns={4} /> : error || !data ? <ErrorState message={error || "Job not found"} onRetry={() => void load()} /> : <>
        <RecruitmentPageTitle eyebrow={`${data.job.department || "Hiring"} · ${data.job.status}`} title={data.job.title} description={`${data.job.location || "Flexible location"} · ${data.job.employmentType || "Employment type not set"} · ${data.job.openings} opening${data.job.openings === 1 ? "" : "s"}`}
          action={canManageOrganization ? <div className="flex gap-2"><Button variant="outline" asChild><Link to="/recruitment/jobs/$jobId/edit" params={{ jobId }}><PencilIcon /> Edit</Link></Button>{JOB_TRANSITIONS[data.job.status].map((status) => <Button key={status} variant={status === "open" ? "default" : "outline"} className="capitalize" onClick={() => void transition(status)}>{status}</Button>)}</div> : undefined} />
        {!canManageOrganization && <p className="mb-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Read-only: organization admin access is required to change this job or its ranking rubric.</p>}
        {settings?.organizationPath && data.job.publicSlug && <PublicSharePanel key={`${data.job._id}:${data.job.socialShareText}`} job={data.job} organizationPath={settings.organizationPath} onSaved={load} canManage={canManageOrganization} />}
        <RubricWorkflow jobId={jobId} className="mb-6" canManage={canManageOrganization} />
        <div className="mb-5 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"><MapPinIcon className="size-4" /><span>Move applicants with each card's stage control. Every move is recorded in activity.</span></div>
        <div className="flex gap-4 overflow-x-auto pb-5">{stages.map((stage) => { const items = data.byStage[stage.id] ?? []
          return <section key={stage.id} className="w-[300px] shrink-0"><div className="mb-3 flex items-center gap-2 px-1"><span className="size-2.5 rounded-full" style={{ background: stage.color ?? "#64748b" }} /><h2 className="text-sm font-semibold">{stage.name}</h2><Badge variant="secondary" className="ml-auto">{items.length}</Badge></div><div className="space-y-3 rounded-2xl bg-muted/70 p-2.5 min-h-60">
            {!items.length ? <div className="flex h-28 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">No applicants</div> : items.map((application) => { const candidate = entity(application.candidateId)
              return <article key={application._id} className="rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"><Link to="/recruitment/applications/$applicationId" params={{ applicationId: application._id }} className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{initials(candidate?.fullName ?? "C")}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{candidate?.fullName ?? "Candidate"}</p><p className="truncate text-xs text-muted-foreground">{candidate?.headline || candidate?.email}</p></div></Link><div className="mt-4"><Select value={application.stageId} disabled={busy === application._id} onValueChange={(value) => void move(application, value)}><SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{stages.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div></article>
            })}</div></section> })}
        </div>
        {!data.applications.length && <EmptyState icon={UsersRoundIcon} title="The pipeline is ready" description="Applications added to this job will appear in the first active stage." />}
      </>}
    </RecruitmentShell>
  )
}
