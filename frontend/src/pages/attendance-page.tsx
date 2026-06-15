import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  CalendarDaysIcon,
  CameraIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { DatePicker } from "@/components/date-picker"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadAttendanceWorkbook, type AttendanceExportRow } from "@/lib/attendance-export"
import { API_ORIGIN, getEmbedOrigin } from "@/lib/env"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const API_BASE = `${API_ORIGIN}/api/v1/attendance`

type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "missing_checkout" | "flagged"

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
  checkInSelfieKey: string | null
  checkOutSelfieKey: string | null
  selfiePreview: string | null
  status: AttendanceStatus
  source: "embed_pos" | "manual" | null
  notes: string | null
}

type AttendanceRangeRow = AttendanceExportRow

type TrendPoint = {
  date: string
  label: string
  present: number
  missingCheckout: number
  absent: number
}

type AttendanceEmployee = {
  _id: string
  employeeCode: string | null
  fullName: string
  title: string | null
  attendancePinSet: boolean
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
  employees: AttendanceEmployee[]
  absentEmployees: AttendanceEmployee[]
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

function parseWorkDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function toWorkDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addWorkDays(value: string, delta: number): string {
  const date = parseWorkDate(value)
  date.setDate(date.getDate() + delta)
  return toWorkDate(date)
}

const trendChartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  missingCheckout: { label: "Missing Checkout", color: "var(--chart-3)" },
  absent: { label: "Absent", color: "var(--chart-5)" },
} satisfies ChartConfig

const CHART_RANGES = [7, 30] as const
type ChartRange = (typeof CHART_RANGES)[number]

function statusVariant(status: AttendanceStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "present") return "default"
  if (status === "missing_checkout" || status === "late" || status === "half_day") return "secondary"
  if (status === "flagged") return "destructive"
  return "outline"
}

function mapUrl(location: AttendanceLocation) {
  return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=18/${location.latitude}/${location.longitude}`
}

export default function AttendancePage() {
  const [date, setDate] = useState(localDate)
  const [data, setData] = useState<AttendanceResponse | null>(null)
  const [organizationId, setOrganizationId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [manualForm, setManualForm] = useState({
    employeeId: "",
    status: "present" as AttendanceStatus,
    checkInAt: "",
    checkOutAt: "",
    notes: "",
  })
  const [editForm, setEditForm] = useState({
    status: "present" as AttendanceStatus,
    checkInAt: "",
    checkOutAt: "",
    notes: "",
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [chartRange, setChartRange] = useState<ChartRange>(30)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(true)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [rangeForm, setRangeForm] = useState({ from: "", to: "" })
  const [rangeExporting, setRangeExporting] = useState(false)

  const today = localDate()
  const isToday = date >= today

  const posUrl = useMemo(() => {
    return organizationId ? `${getEmbedOrigin()}/attendance/${organizationId}` : ""
  }, [organizationId])

  const fetchOrganization = useCallback(async () => {
    const response = await fetch(`${API_ORIGIN}/api/v1/organization/me`, { credentials: "include" })
    if (!response.ok) return
    const body = await response.json()
    setOrganizationId(body.organization?._id ?? "")
  }, [])

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}?date=${encodeURIComponent(date)}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load attendance")
      setData(body)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance")
    } finally {
      setLoading(false)
    }
  }, [date])

  const fetchTrend = useCallback(async () => {
    const from = addWorkDays(date, -(chartRange - 1))
    const points: TrendPoint[] = []
    for (let offset = chartRange - 1; offset >= 0; offset -= 1) {
      const day = addWorkDays(date, -offset)
      points.push({ date: day, label: format(parseWorkDate(day), "d MMM"), present: 0, missingCheckout: 0, absent: 0 })
    }
    const byDate = new Map(points.map((point) => [point.date, point]))
    setTrendLoading(true)
    try {
      const params = new URLSearchParams({ from, to: date })
      const response = await fetch(`${API_BASE}/range?${params.toString()}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to load attendance trend")
      for (const row of (body?.rows ?? []) as AttendanceRangeRow[]) {
        const point = byDate.get(row.date)
        if (!point) continue
        if (row.status === "present") point.present += 1
        else if (row.status === "missing_checkout") point.missingCheckout += 1
        else if (row.status === "absent") point.absent += 1
      }
      setTrend(points)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance trend")
      setTrend(points)
    } finally {
      setTrendLoading(false)
    }
  }, [date, chartRange])

  useEffect(() => {
    void fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    void fetchAttendance()
  }, [fetchAttendance])

  useEffect(() => {
    void fetchTrend()
  }, [fetchTrend])

  function openEdit(record: AttendanceRecord) {
    setEditing(record)
    setEditForm({
      status: record.status,
      checkInAt: record.checkInAt ? record.checkInAt.slice(0, 16) : "",
      checkOutAt: record.checkOutAt ? record.checkOutAt.slice(0, 16) : "",
      notes: record.notes ?? "",
    })
  }

  async function createManualAttendance() {
    if (!manualForm.employeeId) {
      toast.error("Select an employee")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeId: manualForm.employeeId,
          workDate: date,
          status: manualForm.status,
          checkInAt: manualForm.checkInAt ? new Date(manualForm.checkInAt).toISOString() : null,
          checkOutAt: manualForm.checkOutAt ? new Date(manualForm.checkOutAt).toISOString() : null,
          notes: manualForm.notes,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to add attendance")
      toast.success("Attendance added")
      setManualOpen(false)
      setManualForm({ employeeId: "", status: "present", checkInAt: "", checkOutAt: "", notes: "" })
      await fetchAttendance()
      void fetchTrend()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add attendance")
    } finally {
      setSaving(false)
    }
  }

  async function updateAttendance() {
    if (!editing) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${editing._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: editForm.status,
          checkInAt: editForm.checkInAt ? new Date(editForm.checkInAt).toISOString() : null,
          checkOutAt: editForm.checkOutAt ? new Date(editForm.checkOutAt).toISOString() : null,
          notes: editForm.notes,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to update attendance")
      toast.success("Attendance updated")
      setEditing(null)
      await fetchAttendance()
      void fetchTrend()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update attendance")
    } finally {
      setSaving(false)
    }
  }

  async function copyPosUrl() {
    if (!posUrl) return
    await navigator.clipboard.writeText(posUrl)
    toast.success("POS link copied")
  }

  function exportThisDay() {
    if (!data) return
    const rows: AttendanceExportRow[] = [
      ...data.records.map((record) => ({
        employeeName: record.employeeNameSnapshot,
        employeeCode: record.employeeCodeSnapshot,
        date: record.workDate,
        status: record.status,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        source: record.source,
        notes: record.notes,
      })),
      ...data.absentEmployees.map((employee) => ({
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        date,
        status: "absent" as const,
        checkInAt: null,
        checkOutAt: null,
        source: null,
        notes: null,
      })),
    ].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    downloadAttendanceWorkbook(rows, `attendance-${date}.xlsx`)
  }

  function openRangeDialog() {
    setRangeForm({ from: addWorkDays(date, -29), to: date })
    setRangeOpen(true)
  }

  async function exportRange() {
    if (!rangeForm.from || !rangeForm.to) {
      toast.error("Select a start and end date")
      return
    }
    setRangeExporting(true)
    try {
      const params = new URLSearchParams({ from: rangeForm.from, to: rangeForm.to })
      const response = await fetch(`${API_BASE}/range?${params.toString()}`, { credentials: "include" })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to export attendance")
      const rows = (body?.rows ?? []) as AttendanceExportRow[]
      if (rows.length === 0) {
        toast.error("No attendance to export for this range")
        return
      }
      downloadAttendanceWorkbook(rows, `attendance-${body.from}-to-${body.to}.xlsx`)
      setRangeOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export attendance")
    } finally {
      setRangeExporting(false)
    }
  }

  const summary = data?.summary
  const summaryCards: { label: string; value: number; helper: string; icon: LucideIcon }[] = [
    { label: "Present", value: summary?.present ?? 0, helper: "Checked in and out", icon: CheckCircle2Icon },
    { label: "Absent", value: summary?.absent ?? 0, helper: "No record today", icon: UsersIcon },
    { label: "Missing Checkout", value: summary?.missingCheckout ?? 0, helper: "Checked in only", icon: Clock3Icon },
    { label: "Flagged", value: summary?.flagged ?? 0, helper: "Needs review", icon: ShieldAlertIcon },
    { label: "Total Employees", value: summary?.totalEmployees ?? 0, helper: "Active employees", icon: CalendarDaysIcon },
  ]

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Employees", href: "/employees" }, { label: "Attendance" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchAttendance()
                void fetchTrend()
              }}
              disabled={loading}
            >
              <RefreshCwIcon className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!data}>
                  <DownloadIcon />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={exportThisDay}>Export This Day</DropdownMenuItem>
                <DropdownMenuItem onClick={openRangeDialog}>Export Date Range...</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <PlusIcon />
              Add Attendance
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-4 lg:px-6 lg:py-5">
        <PageHeader
          title="Attendance"
          description="Daily check-ins, location and selfie evidence, and corrections."
          actions={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous day"
                  onClick={() => setDate(addWorkDays(date, -1))}
                >
                  <ChevronLeftIcon />
                </Button>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-40 justify-start font-normal">
                      <CalendarDaysIcon />
                      {format(parseWorkDate(date), "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseWorkDate(date)}
                      onSelect={(selected) => {
                        if (selected) setDate(toWorkDate(selected))
                        setPickerOpen(false)
                      }}
                      disabled={{ after: new Date() }}
                      defaultMonth={parseWorkDate(date)}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next day"
                  onClick={() => setDate(addWorkDays(date, 1))}
                  disabled={isToday}
                >
                  <ChevronRightIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDate(today)} disabled={isToday}>
                  Today
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => void copyPosUrl()} disabled={!posUrl}>
                <CopyIcon />
                Copy POS Link
              </Button>
              {posUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={posUrl} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon />
                    Open POS
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ExternalLinkIcon />
                  Open POS
                </Button>
              )}
            </div>
          }
        />

        {loading ? (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[130px] rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : (
          <div className="grid gap-6 animate-in fade-in-0 duration-500">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {summaryCards.map(({ label, value, helper, icon: Icon }) => (
                <StatCard key={label} title={label} value={value} helper={helper} icon={Icon} />
              ))}
            </div>

            <section className="rounded-xl border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Attendance Trend</h2>
                  <p className="text-sm text-muted-foreground">
                    Daily breakdown for the {chartRange} days ending {format(parseWorkDate(date), "dd MMM yyyy")}.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border p-0.5">
                  {CHART_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setChartRange(range)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        chartRange === range
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {range}d
                    </button>
                  ))}
                </div>
              </div>
              {trendLoading && trend.length === 0 ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                <ChartContainer config={trendChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart
                    data={trend}
                    margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                    onClick={(state) => {
                      const point = state?.activePayload?.[0]?.payload as TrendPoint | undefined
                      if (point?.date) setDate(point.date)
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={16}
                      interval="preserveStartEnd"
                    />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="present" stackId="attendance" fill="var(--color-present)" />
                    <Bar dataKey="missingCheckout" stackId="attendance" fill="var(--color-missingCheckout)" />
                    <Bar dataKey="absent" stackId="attendance" fill="var(--color-absent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5">
              <div className="mb-5">
                <h2 className="text-base font-semibold">Attendance Records</h2>
                <p className="text-sm text-muted-foreground">Selfies and map links appear when the POS captured them.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.records ?? []).map((record) => (
                    <TableRow key={record._id}>
                      <TableCell>
                        <div className="font-medium">{record.employeeNameSnapshot}</div>
                        <div className="text-xs text-muted-foreground">{record.employeeCodeSnapshot || "No code"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(record.status)}>{statusLabels[record.status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatTime(record.checkInAt)}</TableCell>
                      <TableCell className="tabular-nums">{formatTime(record.checkOutAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {record.selfiePreview && (
                            <Button variant="outline" size="xs" asChild>
                              <a href={record.selfiePreview} target="_blank" rel="noreferrer">
                                <CameraIcon />
                                Selfie
                              </a>
                            </Button>
                          )}
                          {(record.checkOutLocation ?? record.checkInLocation) && (
                            <Button variant="outline" size="xs" asChild>
                              <a href={mapUrl((record.checkOutLocation ?? record.checkInLocation)!)} target="_blank" rel="noreferrer">
                                <MapPinIcon />
                                Map
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>
                          <PencilIcon />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        No attendance records for this date.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-base font-semibold">Absent Employees</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Active employees without a record for the selected date.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(data?.absentEmployees ?? []).map((employee) => (
                  <Badge key={employee._id} variant="secondary">
                    {employee.fullName}{employee.employeeCode ? ` · ${employee.employeeCode}` : ""}
                  </Badge>
                ))}
                {data?.absentEmployees.length === 0 && <p className="text-sm text-muted-foreground">No absent employees.</p>}
              </div>
            </section>
          </div>
        )}
      </main>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Attendance</DialogTitle>
            <DialogDescription>Use this for exceptions, missed punches, or approved field attendance.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={manualForm.employeeId} onValueChange={(employeeId) => setManualForm((form) => ({ ...form, employeeId }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(data?.employees ?? []).map((employee) => (
                    <SelectItem key={employee._id} value={employee._id}>{employee.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AttendanceEditorFields
              value={manualForm}
              onChange={(fields) => setManualForm((form) => ({ ...form, ...fields }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={() => void createManualAttendance()} disabled={saving}>Save Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Attendance</DialogTitle>
            <DialogDescription>Adjust the status, times, or notes for this record.</DialogDescription>
          </DialogHeader>
          <AttendanceEditorFields value={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void updateAttendance()} disabled={saving}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Date Range</DialogTitle>
            <DialogDescription>
              Download an Excel file with one row per employee per day, including absent days.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker
              label="From"
              value={rangeForm.from}
              onChange={(from) => setRangeForm((form) => ({ ...form, from }))}
            />
            <DatePicker
              label="To"
              value={rangeForm.to}
              onChange={(to) => setRangeForm((form) => ({ ...form, to }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRangeOpen(false)}>Cancel</Button>
            <Button onClick={() => void exportRange()} disabled={rangeExporting}>
              <DownloadIcon />
              Export Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function StatCard({
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
    <div className="rounded-xl border bg-card p-5 transition-colors hover:bg-card/80">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

type AttendanceEditorValue = {
  status: AttendanceStatus
  checkInAt: string
  checkOutAt: string
  notes: string
}

function AttendanceEditorFields({
  value,
  onChange,
}: {
  value: AttendanceEditorValue
  onChange: (value: AttendanceEditorValue) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={value.status} onValueChange={(status) => onChange({ ...value, status: status as AttendanceStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Check-in time</Label>
          <Input type="datetime-local" value={value.checkInAt} onChange={(event) => onChange({ ...value, checkInAt: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Check-out time</Label>
          <Input type="datetime-local" value={value.checkOutAt} onChange={(event) => onChange({ ...value, checkOutAt: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Notes</Label>
        <textarea
          className="min-h-24 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
        />
      </div>
    </div>
  )
}
