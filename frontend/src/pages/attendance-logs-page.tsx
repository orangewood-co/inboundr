import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Clock3Icon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { LocationEvidence, SelfieEvidence } from "@/components/attendance-evidence"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { API_ORIGIN } from "@/lib/env"
import { formatTime } from "@/lib/format"

const API_BASE = `${API_ORIGIN}/api/v1/attendance`

type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "missing_checkout" | "flagged"
type AttendanceAction = "check_in" | "check_out"

type AttendanceLocation = {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: string
}

type AttendanceRecord = {
  _id: string
  employeeId: string
  employeeCodeSnapshot: string | null
  employeeNameSnapshot: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInLocation: AttendanceLocation | null
  checkOutLocation: AttendanceLocation | null
  checkInSelfiePreview: string | null
  checkOutSelfiePreview: string | null
  status: AttendanceStatus
  source: "embed_pos" | "manual" | null
  notes: string | null
}

type AttendanceResponse = {
  date: string
  summary: {
    present: number
    missingCheckout: number
    flagged: number
    absent: number
    totalEmployees: number
  }
  records: AttendanceRecord[]
}

type AttendanceLogEntry = {
  id: string
  action: AttendanceAction
  timestamp: string
  employeeName: string
  employeeCode: string | null
  location: AttendanceLocation | null
  selfiePreview: string | null
  status: AttendanceStatus
  source: AttendanceRecord["source"]
  notes: string | null
}

const actionLabels: Record<AttendanceAction, string> = {
  check_in: "Check In",
  check_out: "Check Out",
}

const sourceLabels: Record<NonNullable<AttendanceRecord["source"]>, string> = {
  embed_pos: "POS",
  manual: "Manual",
}

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  missing_checkout: "Missing Checkout",
  flagged: "Flagged",
}

function localDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function statusVariant(status: AttendanceStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "present") return "default"
  if (status === "missing_checkout" || status === "late" || status === "half_day") return "secondary"
  if (status === "flagged") return "destructive"
  return "outline"
}

function logEntriesFromRecords(records: AttendanceRecord[]): AttendanceLogEntry[] {
  return records
    .flatMap((record) => {
      const entries: AttendanceLogEntry[] = []
      if (record.checkInAt) {
        entries.push({
          id: `${record._id}:check_in`,
          action: "check_in",
          timestamp: record.checkInAt,
          employeeName: record.employeeNameSnapshot,
          employeeCode: record.employeeCodeSnapshot,
          location: record.checkInLocation,
          selfiePreview: record.checkInSelfiePreview,
          status: record.status,
          source: record.source,
          notes: record.notes,
        })
      }
      if (record.checkOutAt) {
        entries.push({
          id: `${record._id}:check_out`,
          action: "check_out",
          timestamp: record.checkOutAt,
          employeeName: record.employeeNameSnapshot,
          employeeCode: record.employeeCodeSnapshot,
          location: record.checkOutLocation,
          selfiePreview: record.checkOutSelfiePreview,
          status: record.status,
          source: record.source,
          notes: record.notes,
        })
      }
      return entries
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export default function AttendanceLogsPage() {
  const [data, setData] = useState<AttendanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const today = localDate()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}?date=${encodeURIComponent(today)}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load attendance logs")
      setData(body)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance logs")
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchLogs()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [fetchLogs])

  const logs = useMemo(() => logEntriesFromRecords(data?.records ?? []), [data?.records])
  const checkIns = logs.filter((entry) => entry.action === "check_in").length
  const checkOuts = logs.filter((entry) => entry.action === "check_out").length

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: "Attendance", href: "/employees/attendance" },
          { label: "Today's Logs" },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="/employees/attendance">
                <ArrowLeftIcon />
                Back to Attendance
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
              <RefreshCwIcon className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-5">
        <PageHeader
          title="Today's Attendance Logs"
          description="Time-ordered check-ins and check-outs captured from the POS for the current day."
        />

        {loading ? (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[118px] rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        ) : (
          <div className="grid gap-6 animate-in fade-in-0 duration-500">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <LogStatCard title="Total Logs" value={logs.length} helper={`For ${data?.date ?? today}`} icon={Clock3Icon} />
              <LogStatCard title="Check Ins" value={checkIns} helper="Employees who punched in" icon={LogInIcon} />
              <LogStatCard title="Check Outs" value={checkOuts} helper="Employees who punched out" icon={LogOutIcon} />
              <LogStatCard
                title="Missing Checkout"
                value={data?.summary.missingCheckout ?? 0}
                helper="Checked in only"
                icon={CheckCircle2Icon}
              />
            </div>

            <section className="rounded-xl border bg-card p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Current Day Logs</h2>
                  <p className="text-sm text-muted-foreground">
                    Each row is a captured check-in or check-out event, sorted by time.
                  </p>
                </div>
                <Badge variant="outline">{logs.length} Logs</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Selfie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatTime(entry.timestamp)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{entry.employeeCode || "No code"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.action === "check_in" ? "default" : "secondary"}>
                          {entry.action === "check_in" ? <LogInIcon className="size-3" /> : <LogOutIcon className="size-3" />}
                          {actionLabels[entry.action]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.location ? (
                          <LocationEvidence
                            location={entry.location}
                            title={entry.employeeName}
                            subtitle={`${actionLabels[entry.action]} - ${formatTime(entry.timestamp)}`}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">No location</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.selfiePreview ? (
                          <SelfieEvidence
                            src={entry.selfiePreview}
                            title={entry.employeeName}
                            subtitle={`${actionLabels[entry.action]} - ${formatTime(entry.timestamp)}`}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">No selfie</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={statusVariant(entry.status)}>{statusLabels[entry.status]}</Badge>
                          {entry.source ? <Badge variant="outline">{sourceLabels[entry.source]}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64 text-sm text-muted-foreground">
                        <span className="line-clamp-2">{entry.notes || "-"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No attendance logs for today yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          </div>
        )}
      </main>
    </AppLayout>
  )
}

function LogStatCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string
  value: number
  helper: string
  icon: LucideIcon
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      </div>
    </section>
  )
}
