import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Clock3Icon, FileLock2Icon, FileUpIcon, MailIcon, MapPinIcon, PaperclipIcon, PhoneIcon, Trash2Icon, UserRoundPlusIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { ApplicationRankingPanel } from "@/components/recruitment/application-ranking-panel"
import { RecruitmentPageTitle, RecruitmentShell } from "@/components/recruitment/recruitment-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useEntitlements } from "@/lib/entitlements"
import { entity, recruitmentApi, type Attachment } from "@/lib/recruitment"

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "No answer"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(formatAnswer).join(", ")
  if (typeof value === "object") {
    const file = value as { fileName?: unknown; originalName?: unknown }
    return String(file.fileName ?? file.originalName ?? "Submitted file")
  }
  return String(value)
}

export default function RecruitmentApplicationDetailPage() {
  const { canManageOrganization } = useEntitlements()
  const { applicationId } = useParams({ strict: false }) as { applicationId: string }
  const navigate = useNavigate()
  const [data, setData] = useState<Awaited<ReturnType<typeof recruitmentApi.application>> | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [kind, setKind] = useState<Attachment["kind"]>("resume")
  const [deleteKind, setDeleteKind] = useState<"application" | "candidate" | null>(null)
  const [confirmation, setConfirmation] = useState("")
  const [handoffConflict, setHandoffConflict] = useState<Awaited<ReturnType<typeof recruitmentApi.employeeHandoff>> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => {
    setError("")
    try { setData(await recruitmentApi.application(applicationId)) }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load applicant") }
  }, [applicationId])
  useEffect(() => {
    // Initial remote hydration is intentionally effect-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  async function addNote() {
    if (!note.trim()) return
    setBusy("note")
    try { await recruitmentApi.addNote(applicationId, note); setNote(""); await load(); toast.success("Internal note added") }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to add note") } finally { setBusy("") }
  }
  async function upload(file: File) {
    setBusy("upload")
    try { await recruitmentApi.uploadAttachment(applicationId, file, kind); await load(); toast.success("Private attachment uploaded") }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to upload attachment") } finally { setBusy("") }
  }
  async function continueEmployeeHandoff(handoff = handoffConflict) {
    if (!handoff) return
    sessionStorage.setItem("recruitment.employee-prefill", JSON.stringify({
      version: 1,
      createdAt: Date.now(),
      applicationId: handoff.applicationId,
      jobTitle: handoff.jobTitle,
      prefill: handoff.prefill,
    }))
    setHandoffConflict(null)
    await navigate({ to: "/employees/new" })
  }
  async function prepareEmployee() {
    setBusy("handoff")
    try {
      const handoff = await recruitmentApi.employeeHandoff(applicationId)
      if (handoff.employeeEmailConflict.exists) setHandoffConflict(handoff)
      else await continueEmployeeHandoff(handoff)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to prepare employee") }
    finally { setBusy("") }
  }
  async function confirmDelete() {
    if (!deleteKind || !canManageOrganization) return
    setBusy("delete")
    try {
      const result = deleteKind === "application"
        ? await recruitmentApi.deleteApplication(applicationId)
        : await recruitmentApi.deleteCandidate(typeof data?.application.candidateId === "string" ? data.application.candidateId : data?.application.candidateId._id ?? "")
      const records = Object.values(result.deleted).reduce((sum, value) => sum + value, 0)
      const storage = `${result.storage.deleted}/${result.storage.requested} stored files removed`
      const retained = result.candidate ? ` Candidate retained with ${result.candidate.remainingApplications} other application(s).` : result.retainedJobRubrics ? " Job rubrics were retained." : ""
      const failures = result.storage.failed ? ` Cleanup failed for attachment IDs: ${result.storage.failedAttachmentIds.join(", ")}.` : ""
      toast.success(`${deleteKind === "application" ? "Application" : "Candidate"} deleted`, {
        description: `${records} database records removed; ${storage}.${retained}${failures}`,
      })
      await navigate({ to: "/recruitment/applicants", replace: true })
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete record") }
    finally { setBusy("") }
  }
  async function moveToStage(stageId: string) {
    setBusy("stage")
    try {
      await recruitmentApi.moveApplication(applicationId, stageId)
      await load()
      toast.success("Application stage updated")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to move application")
    } finally {
      setBusy("")
    }
  }
  if (error) return <RecruitmentShell><ErrorState message={error} onRetry={() => void load()} /></RecruitmentShell>
  if (!data) return <RecruitmentShell><ListSkeleton rows={8} columns={3} /></RecruitmentShell>
  const { application } = data
  const candidate = entity(application.candidateId)
  const job = entity(application.jobId)
  const stage = job?.stages.find((item) => item.id === application.stageId)
  const canHandoff = application.status === "hired" && stage?.isTerminal === true && stage.terminalOutcome === "hired"
  const answerFields = application.formSchemaSnapshot?.fields ?? []
  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Applicants", href: "/recruitment/applicants" }, { label: candidate?.fullName ?? "Candidate" }]}>
      <RecruitmentPageTitle eyebrow={`${job?.title ?? "Application"} · ${stage?.name ?? application.stageId}`} title={candidate?.fullName ?? "Candidate"} description={candidate?.headline || "Candidate application and internal hiring record"} action={canHandoff && canManageOrganization ? <Button onClick={() => void prepareEmployee()} disabled={busy === "handoff"}>{busy === "handoff" ? <Spinner /> : <UserRoundPlusIcon />} Create employee</Button> : undefined} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-5 sm:flex-row">
              <div><h2 className="text-lg font-semibold">Candidate profile</h2><div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <a href={`mailto:${candidate?.email}`} className="flex items-center gap-2 hover:text-foreground"><MailIcon className="size-4" />{candidate?.email || "No email"}</a>
                <span className="flex items-center gap-2"><PhoneIcon className="size-4" />{candidate?.phone || "No phone"}</span>
                <span className="flex items-center gap-2"><MapPinIcon className="size-4" />{candidate?.location || "No location"}</span>
                <span className="flex items-center gap-2"><Clock3Icon className="size-4" />Applied {formatDate(application.appliedAt)}</span>
              </div></div>
              <div className="min-w-48 sm:text-right"><Badge variant="outline" className="capitalize">{application.status}</Badge><p className="mt-3 text-xs text-muted-foreground">Source: {application.source}</p>{job?.stages.length ? <Select value={application.stageId} disabled={busy === "stage"} onValueChange={(value) => void moveToStage(value)}><SelectTrigger className="mt-3 w-full sm:ml-auto"><SelectValue /></SelectTrigger><SelectContent>{[...job.stages].sort((a, b) => a.order - b.order).map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select> : null}</div>
            </div>
            {!!candidate?.skills.length && <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">{candidate.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div>}
          </section>
          <section className="rounded-2xl border bg-card p-6 shadow-xs"><h2 className="font-semibold">Submitted screening answers</h2><p className="text-sm text-muted-foreground">Questions are shown from the form snapshot captured when this application was submitted.</p><dl className="mt-5 divide-y rounded-xl border">{answerFields.length ? answerFields.map((field) => <div key={field.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(160px,.7fr)_1.3fr]"><dt className="text-sm font-medium">{field.label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{formatAnswer(application.answers?.[field.id])}</dd></div>) : Object.entries(application.answers ?? {}).map(([fieldId, answer]) => <div key={fieldId} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(160px,.7fr)_1.3fr]"><dt className="text-sm font-medium">{fieldId}</dt><dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{formatAnswer(answer)}</dd></div>)}</dl>{!answerFields.length && !Object.keys(application.answers ?? {}).length && <p className="mt-4 text-sm text-muted-foreground">No screening answers were submitted.</p>}</section>
          <ApplicationRankingPanel applicationId={applicationId} jobId={job?._id} canManage={canManageOrganization} />
          <section className="rounded-2xl border bg-card p-6 shadow-xs"><h2 className="font-semibold">Internal notes</h2><p className="text-sm text-muted-foreground">Only people with recruitment access can see these notes.</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-4 min-h-24 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Add interview context, concerns, or next steps…" />
            <div className="mt-3 flex justify-end"><Button size="sm" disabled={!note.trim() || busy === "note"} onClick={() => void addNote()}>{busy === "note" && <Spinner />} Add private note</Button></div>
            <div className="mt-5 space-y-3 border-t pt-5">{!data.notes.length ? <p className="text-sm text-muted-foreground">No notes yet.</p> : data.notes.map((item) => <article key={item._id} className="rounded-xl bg-muted/60 p-4"><p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{item.authorName || "Team member"} · {formatDate(item.createdAt)}</p></article>)}</div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-xs"><div className="flex items-center gap-2"><FileLock2Icon className="size-5" /><h2 className="font-semibold">Private attachments</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Files use short-lived private links and are never publicly exposed.</p>
            <div className="mt-4 flex gap-2"><Select value={kind} onValueChange={(value) => setKind(value as Attachment["kind"])}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="resume">Resume</SelectItem><SelectItem value="cover_letter">Cover letter</SelectItem><SelectItem value="portfolio">Portfolio</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = "" }} /><Button size="icon" variant="outline" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>{busy === "upload" ? <Spinner /> : <FileUpIcon />}</Button></div>
            <div className="mt-4 space-y-2">{!data.attachments.length ? <EmptyState icon={PaperclipIcon} title="No files" description="Upload a resume or private hiring document." className="px-3 py-8" /> : data.attachments.map((item) => <button key={item._id} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted/50" onClick={() => void recruitmentApi.openAttachment(applicationId, item._id).catch((e) => toast.error(e instanceof Error ? e.message : "Unable to open file"))}><FileLock2Icon className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.originalName}</span><span className="text-xs text-muted-foreground">{item.kind.replace("_", " ")} · {(item.size / 1024).toFixed(0)} KB</span></span></button>)}</div>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2"><MailIcon className="size-5" /><h2 className="font-semibold">Email acknowledgement</h2></div>
            {!(data.acknowledgements ?? []).length ? (
              <p className="mt-3 text-sm text-muted-foreground">No acknowledgement delivery has been recorded.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {(data.acknowledgements ?? []).map((delivery) => (
                  <article key={delivery._id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">Revision {delivery.applicationRevision}</span>
                      <Badge variant={delivery.status === "failed" ? "destructive" : delivery.status === "sent" ? "secondary" : "outline"} className="capitalize">{delivery.status}</Badge>
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{delivery.recipient}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {delivery.status === "sent" && delivery.sentAt
                        ? `Sent ${formatDate(delivery.sentAt)}`
                        : `Updated ${formatDate(delivery.updatedAt)}`}
                      {delivery.attempts > 1 ? ` · ${delivery.attempts} attempts` : ""}
                    </p>
                    {delivery.status === "failed" && delivery.error && <p className="mt-2 text-xs leading-5 text-destructive">{delivery.error}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="overflow-hidden rounded-2xl border bg-card shadow-xs"><div className="border-b px-5 py-4"><h2 className="font-semibold">Activity timeline</h2><p className="text-xs text-muted-foreground">Immutable hiring context</p></div>
            {!data.activity.length ? <EmptyState icon={Clock3Icon} title="No activity" className="py-8" /> : <div className="p-5">{data.activity.map((item, index) => <div key={item._id} className="relative flex gap-3 pb-5 last:pb-0">{index < data.activity.length - 1 && <span className="absolute top-3 bottom-0 left-[5px] w-px bg-border" />}<span className="relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-background bg-foreground" /><div><p className="text-sm leading-5">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorName || "Workspace"} · {formatDate(item.createdAt)}</p></div></div>)}</div>}
          </section>
          <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5"><div className="flex items-center gap-2 text-destructive"><Trash2Icon className="size-4" /><h2 className="font-semibold">Delete recruitment data</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Deleting only this application retains the shared candidate profile and other applications. Deleting the candidate permanently removes the profile, every application, notes, rankings, activity, and private attachments.</p>{canManageOrganization ? <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setConfirmation(""); setDeleteKind("application") }}>Delete application</Button><Button variant="destructive" size="sm" onClick={() => { setConfirmation(""); setDeleteKind("candidate") }}>Delete candidate and all applications</Button></div> : <p className="mt-3 text-xs text-muted-foreground">Read-only: organization admin access is required to permanently delete recruitment records.</p>}</section>
        </aside>
      </div>
      <Dialog open={deleteKind !== null} onOpenChange={(open) => { if (!open && busy !== "delete") setDeleteKind(null) }}>
        <DialogContent><DialogHeader><DialogTitle>Delete {deleteKind === "candidate" ? "candidate" : "application"} permanently?</DialogTitle><DialogDescription>{deleteKind === "candidate" ? `This removes ${candidate?.fullName ?? "this candidate"} and all of their applications across jobs. Job rubrics are retained.` : `This removes this ${job?.title ?? "job"} application and its dependent records. The candidate profile and any other applications remain.`}</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="delete-confirmation">Type <strong>{deleteKind === "candidate" ? "DELETE CANDIDATE" : "DELETE APPLICATION"}</strong> to confirm</Label><Input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div><DialogFooter><DialogClose asChild><Button variant="outline" disabled={busy === "delete"}>Cancel</Button></DialogClose><Button variant="destructive" disabled={busy === "delete" || confirmation !== (deleteKind === "candidate" ? "DELETE CANDIDATE" : "DELETE APPLICATION")} onClick={() => void confirmDelete()}>{busy === "delete" && <Spinner />} Delete permanently</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={handoffConflict !== null} onOpenChange={(open) => !open && setHandoffConflict(null)}>
        <DialogContent><DialogHeader><DialogTitle>An employee already uses this email</DialogTitle><DialogDescription>{handoffConflict?.employeeEmailConflict.exists ? `${handoffConflict.employeeEmailConflict.fullName} (${handoffConflict.employeeEmailConflict.status}) already has an employee record with ${handoffConflict.employeeEmailConflict.email}. Continuing may be rejected as a duplicate.` : ""}</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>{handoffConflict?.employeeEmailConflict.exists && <Button variant="outline" onClick={() => void navigate({ to: "/employees/$id", params: { id: handoffConflict.employeeEmailConflict.employeeId } })}>Open existing employee</Button>}<Button onClick={() => void continueEmployeeHandoff()}>Continue with prefill</Button></DialogFooter></DialogContent>
      </Dialog>
    </RecruitmentShell>
  )
}
