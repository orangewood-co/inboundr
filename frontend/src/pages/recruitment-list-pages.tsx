import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowRightIcon,
  AlertTriangleIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CircleCheckBigIcon,
  Clock3Icon,
  InboxIcon,
  SearchIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { DataTable, DataTableColumnHeader } from "@/components/recruitment/data-table"
import { RecruitmentPageTitle, RecruitmentShell } from "@/components/recruitment/recruitment-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  entity,
  recruitmentApi,
  type Activity,
  type Application,
  type JobStatus,
  type RecruitmentJob,
} from "@/lib/recruitment"
import { useEntitlements } from "@/lib/entitlements"

function relativeDate(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value))
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    open: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    hired: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
    paused: "border-amber-200 bg-amber-50 text-amber-700",
  }
  return <Badge variant="outline" className={classes[status] ?? ""}>{status}</Badge>
}

function ActivityList({ items }: { items: Activity[] }) {
  if (!items.length) return <EmptyState icon={CalendarClockIcon} title="No Activity Yet" description="Hiring activity will collect here as your team starts working." />
  return (
    <div className="divide-y">
      {items.slice(0, 8).map((item) => (
        <div key={item._id} className="flex gap-3 px-5 py-4">
          <div className="mt-1 size-2 shrink-0 rounded-full bg-foreground/70" />
          <div className="min-w-0">
            <p className="text-sm">{item.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.actorName || "Workspace"} · {relativeDate(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function RecruitmentOverviewPage() {
  const { canManageOrganization } = useEntitlements()
  const [data, setData] = useState<Awaited<ReturnType<typeof recruitmentApi.dashboard>> | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setError("")
    try { setData(await recruitmentApi.dashboard()) } catch (e) { setError(e instanceof Error ? e.message : "Unable to load recruitment") }
  }, [])
  useEffect(() => {
    // Initial remote hydration is intentionally effect-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const stats = data ? [
    { label: "Open roles", value: data.summary.openJobs, note: "Currently recruiting", icon: BriefcaseBusinessIcon },
    { label: "Active applicants", value: data.summary.activeApplications, note: `${data.summary.totalApplications} all time`, icon: UsersRoundIcon },
    { label: "New applications", value: data.summary.newApplications, note: `${data.summary.newCandidates} new candidates · ${data.periodDays}d`, icon: UserRoundPlusIcon },
    { label: "Hires", value: data.summary.hires, note: `Last ${data.periodDays} days`, icon: CircleCheckBigIcon },
  ] : []
  const stageChart = useMemo(() => {
    if (!data) return []
    const totals = new Map<string, number>()
    data.applicationsByStage.forEach((row) => totals.set(row.stageName, (totals.get(row.stageName) ?? 0) + row.count))
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [data])

  return (
    <RecruitmentShell>
      <RecruitmentPageTitle
        title="Overview"
        description="Open roles, applicants, and hiring activity."
        action={canManageOrganization ? <Button asChild><Link to="/recruitment/jobs/new"><UserRoundPlusIcon /> Create Job</Link></Button> : undefined}
      />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !data ? <ListSkeleton rows={5} columns={4} /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, note, icon: Icon }) => (
              <div key={label} className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs">
                <div className="absolute -top-8 -right-8 size-24 rounded-full bg-muted/70" />
                <Icon className="relative size-5 text-muted-foreground" />
                <p className="relative mt-6 text-3xl font-semibold tracking-tight">{value}</p>
                <p className="relative mt-1 text-sm font-medium">{label}</p>
                <p className="relative mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="mb-5"><h2 className="font-semibold">Pipeline Distribution</h2><p className="text-xs text-muted-foreground">Current non-archived applications by stage</p></div>
              {stageChart.length ? <div className="h-64" role="img" aria-label="Bar chart of applications by recruitment stage"><ResponsiveContainer width="100%" height="100%"><BarChart data={stageChart} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip cursor={{ fill: "var(--muted)" }} /><Bar dataKey="count" name="Applicants" fill="var(--foreground)" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={InboxIcon} title="No Pipeline Data" description="Stage distribution appears after applications arrive." className="py-10" />}
            </section>
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="mb-5"><h2 className="font-semibold">Application Sources</h2><p className="text-xs text-muted-foreground">Where current candidates discovered your roles</p></div>
              {data.applicationsBySource.length ? <div className="h-64" role="img" aria-label="Bar chart of applications by source"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.applicationsBySource.slice(0, 8)} margin={{ left: -20, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} /><XAxis dataKey="source" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="count" name="Applicants" fill="#0f766e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={InboxIcon} title="No Source Data" className="py-10" />}
            </section>
          </div>
          <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="border-b px-5 py-4"><h2 className="font-semibold">Applications by Role</h2><p className="text-xs text-muted-foreground">Current application volume for each hiring pipeline</p></div>
            {data.applicationsByJob.length ? <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">{data.applicationsByJob.slice(0, 8).map((row) => <Link key={row.jobId} to="/recruitment/jobs/$jobId" params={{ jobId: row.jobId }} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/40"><span className="truncate text-sm font-medium">{row.jobTitle}</span><Badge variant="secondary">{row.count}</Badge></Link>)}</div> : <p className="px-5 py-6 text-sm text-muted-foreground">No per-role application data yet.</p>}
          </section>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
            <section className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between"><div><h2 className="font-semibold">Conversion by Role</h2><p className="text-xs text-muted-foreground">Unique applicants who reached each stage</p></div><Button variant="ghost" size="sm" asChild><Link to="/recruitment/jobs">Pipelines <ArrowRightIcon /></Link></Button></div>
              <div className="mt-5 space-y-5">{!data.conversionFunnel.length ? <p className="text-sm text-muted-foreground">No conversion history yet.</p> : data.conversionFunnel.slice(0, 5).map((job) => <article key={job.jobId}><div className="mb-2 flex items-center justify-between gap-4"><Link to="/recruitment/jobs/$jobId" params={{ jobId: job.jobId }} className="truncate text-sm font-semibold hover:underline">{job.jobTitle}</Link><span className="shrink-0 text-xs text-muted-foreground">{job.totalApplications} total</span></div><div className="flex min-h-9 overflow-hidden rounded-lg bg-muted">{job.stages.map((stage) => <div key={stage.stageId} className="flex min-w-14 flex-1 flex-col justify-center border-r px-2 last:border-r-0" title={`${stage.stageName}: ${stage.reached} reached (${stage.conversionRate}%)`}><span className="truncate text-[10px] font-medium text-muted-foreground">{stage.stageName}</span><span className="text-xs font-semibold">{stage.conversionRate}%</span></div>)}</div></article>)}</div>
            </section>
            <div className="space-y-6">
              <section className="rounded-2xl border bg-card p-5 shadow-xs"><div className="flex items-center gap-2"><Clock3Icon className="size-4 text-muted-foreground" /><h2 className="font-semibold">Pipeline Aging</h2></div><dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="text-xs text-muted-foreground">Average application</dt><dd className="mt-1 text-2xl font-semibold">{data.aging.averageApplicationAgeDays ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">days</span></dd></div><div><dt className="text-xs text-muted-foreground">Average in stage</dt><dd className="mt-1 text-2xl font-semibold">{data.aging.averageCurrentStageAgeDays ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">days</span></dd></div><div><dt className="text-xs text-muted-foreground">Oldest application</dt><dd className="mt-1 font-semibold">{data.aging.oldestApplicationAgeDays ?? "—"} days</dd></div><div><dt className="text-xs text-muted-foreground">Longest in stage</dt><dd className="mt-1 font-semibold">{data.aging.oldestCurrentStageAgeDays ?? "—"} days</dd></div></dl>{data.aging.byStage.length > 0 && <div className="mt-5 space-y-2 border-t pt-4">{data.aging.byStage.slice(0, 8).map((row) => <div key={`${row.jobId}:${row.stageId}`} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate"><span className="font-medium">{row.jobTitle}</span> · {row.stageName}</span><span className="shrink-0 text-muted-foreground">{row.averageCurrentStageAgeDays ?? "—"}d · {row.currentApplications} active</span></div>)}</div>}</section>
              <section className={`rounded-2xl border p-5 shadow-xs ${data.ranking.failures || data.ranking.manualReview ? "border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30" : "bg-card"}`}><div className="flex items-center gap-2">{data.ranking.failures || data.ranking.manualReview ? <AlertTriangleIcon className="size-4 text-amber-700" /> : <CircleCheckBigIcon className="size-4 text-emerald-600" />}<h2 className="font-semibold">Ranking Queue</h2></div><div className="mt-4 grid grid-cols-5 gap-2 text-center"><div><p className="text-xl font-semibold">{data.ranking.queued}</p><p className="text-[11px] text-muted-foreground">Queued</p></div><div><p className="text-xl font-semibold">{data.ranking.processing}</p><p className="text-[11px] text-muted-foreground">Processing</p></div><div><p className="text-xl font-semibold">{data.ranking.backlog}</p><p className="text-[11px] text-muted-foreground">Backlog</p></div><div><p className="text-xl font-semibold">{data.ranking.failures}</p><p className="text-[11px] text-muted-foreground">Failed</p></div><div><p className="text-xl font-semibold">{data.ranking.manualReview}</p><p className="text-[11px] text-muted-foreground">Review</p></div></div></section>
            </div>
          </div>
          <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div><h2 className="font-semibold">Recent Activity</h2><p className="text-xs text-muted-foreground">A shared record of hiring changes</p></div>
              <Button variant="ghost" size="sm" asChild><Link to="/recruitment/applicants">View Applicants <ArrowRightIcon /></Link></Button>
            </div>
            <ActivityList items={data.recentActivity} />
          </section>
        </>
      )}
    </RecruitmentShell>
  )
}

const JOB_COLUMNS: ColumnDef<RecruitmentJob, unknown>[] = [
  {
    id: "role",
    accessorFn: (job) => job.title,
    header: ({ column }) => <DataTableColumnHeader title="Role" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => (
      <>
        <span className="font-medium">{row.original.title}</span>
        <span className="block text-xs text-muted-foreground">{row.original.department || "No department"} · {row.original.location || "Flexible location"}</span>
      </>
    ),
  },
  {
    id: "status",
    accessorFn: (job) => job.status,
    header: ({ column }) => <DataTableColumnHeader title="Status" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "workplace",
    accessorFn: (job) => job.workplaceType ?? "",
    header: "Workplace",
    cell: ({ row }) => <span className="capitalize text-muted-foreground">{row.original.workplaceType ?? "—"}</span>,
  },
  {
    id: "openings",
    accessorFn: (job) => job.openings,
    header: ({ column }) => <DataTableColumnHeader title="Openings" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => row.original.openings,
  },
  {
    id: "updated",
    accessorFn: (job) => job.updatedAt,
    header: ({ column }) => <DataTableColumnHeader title="Updated" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => <span className="text-muted-foreground">{relativeDate(row.original.updatedAt)}</span>,
  },
]

export function RecruitmentJobsPage() {
  const { canManageOrganization } = useEntitlements()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<RecruitmentJob[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setJobs((await recruitmentApi.jobs({ search, status: status === "all" ? "" : status })).items) }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load jobs") }
    finally { setLoading(false) }
  }, [search, status])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer) }, [load])

  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Jobs" }]}>
      <RecruitmentPageTitle title="Jobs" description="Every role and its current status." action={canManageOrganization ? <Button asChild><Link to="/recruitment/jobs/new">Create Job</Link></Button> : undefined} />
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
        <div className="relative flex-1"><SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search role, department, location…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{(["draft","open","paused","closed","archived"] as JobStatus[]).map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        {loading ? <ListSkeleton rows={7} columns={5} /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !jobs.length ? <EmptyState icon={BriefcaseBusinessIcon} title="No Matching Jobs" description="Create your first role or broaden the current filters." action={canManageOrganization ? <Button asChild size="sm"><Link to="/recruitment/jobs/new">Create Job</Link></Button> : undefined} /> : (
          <DataTable columns={JOB_COLUMNS} data={jobs} onRowClick={(row) => void navigate({ to: "/recruitment/jobs/$jobId", params: { jobId: row.original._id } })} />
        )}
      </div>
    </RecruitmentShell>
  )
}

const APPLICANT_COLUMNS: ColumnDef<Application, unknown>[] = [
  {
    id: "candidate",
    accessorFn: (item) => entity(item.candidateId)?.fullName ?? "",
    header: ({ column }) => <DataTableColumnHeader title="Candidate" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => {
      const candidate = entity(row.original.candidateId)
      return (
        <>
          <span className="font-medium">{candidate?.fullName ?? "Candidate"}</span>
          <span className="block text-xs text-muted-foreground">{candidate?.email}</span>
        </>
      )
    },
  },
  {
    id: "role",
    accessorFn: (item) => entity(item.jobId)?.title ?? "",
    header: ({ column }) => <DataTableColumnHeader title="Role" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => entity(row.original.jobId)?.title ?? "Job",
  },
  {
    id: "stage",
    accessorFn: (item) => entity(item.jobId)?.stages.find((stage) => stage.id === item.stageId)?.name ?? item.stageId,
    header: "Stage",
    cell: ({ row }) => entity(row.original.jobId)?.stages.find((stage) => stage.id === row.original.stageId)?.name ?? row.original.stageId,
  },
  {
    id: "status",
    accessorFn: (item) => item.status,
    header: ({ column }) => <DataTableColumnHeader title="Status" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "applied",
    accessorFn: (item) => item.appliedAt,
    header: ({ column }) => <DataTableColumnHeader title="Applied" sorted={column.getIsSorted()} onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => <span className="text-muted-foreground">{relativeDate(row.original.appliedAt)}</span>,
  },
]

export function RecruitmentApplicantsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Application[]>([])
  const [jobs, setJobs] = useState<RecruitmentJob[]>([])
  const [jobId, setJobId] = useState("all")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [apps, jobsResult] = await Promise.all([recruitmentApi.applications({ jobId: jobId === "all" ? "" : jobId, status: status === "all" ? "" : status }), recruitmentApi.jobs()])
      setItems(apps.items); setJobs(jobsResult.items)
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load applicants") } finally { setLoading(false) }
  }, [jobId, status])
  useEffect(() => {
    // Filter changes require a fresh server-side application page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  const visible = useMemo(() => items.filter((item) => {
    const candidate = entity(item.candidateId)
    return !search || `${candidate?.fullName} ${candidate?.email} ${candidate?.headline}`.toLowerCase().includes(search.toLowerCase())
  }), [items, search])

  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Applicants" }]}>
      <RecruitmentPageTitle title="Applicants" description="All applications across jobs." />
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[1fr_220px_180px]">
        <div className="relative"><SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search applicants…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={jobId} onValueChange={setJobId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All jobs</SelectItem>{jobs.map((job) => <SelectItem key={job._id} value={job._id}>{job.title}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["active","hired","rejected","withdrawn","archived"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        {loading ? <ListSkeleton rows={8} columns={5} /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !visible.length ? <EmptyState icon={UsersRoundIcon} title="No Matching Applicants" description="Applications will appear here when candidates enter a job pipeline." /> : (
          <DataTable columns={APPLICANT_COLUMNS} data={visible} onRowClick={(row) => void navigate({ to: "/recruitment/applications/$applicationId", params: { applicationId: row.original._id } })} />
        )}
      </div>
    </RecruitmentShell>
  )
}
