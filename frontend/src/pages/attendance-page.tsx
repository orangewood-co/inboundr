import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDaysIcon,
  CameraIcon,
  CheckCircle2Icon,
  Clock3Icon,
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
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { API_ORIGIN, getEmbedOrigin } from "@/lib/env"

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
  notes: string | null
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

function formatTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date)
}

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

  useEffect(() => {
    void fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    void fetchAttendance()
  }, [fetchAttendance])

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

  function exportCsv() {
    window.open(`${API_BASE}/export?date=${encodeURIComponent(date)}`, "_blank")
  }

  const summary = data?.summary
  const summaryCards: { label: string; value: number; icon: LucideIcon }[] = [
    { label: "Present", value: summary?.present ?? 0, icon: CheckCircle2Icon },
    { label: "Absent", value: summary?.absent ?? 0, icon: UsersIcon },
    { label: "Missing Checkout", value: summary?.missingCheckout ?? 0, icon: Clock3Icon },
    { label: "Flagged", value: summary?.flagged ?? 0, icon: ShieldAlertIcon },
    { label: "Total Employees", value: summary?.totalEmployees ?? 0, icon: CalendarDaysIcon },
  ]

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Attendance" }]} />
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="mx-auto grid max-w-7xl gap-6 p-5 md:p-8">
          <section className="overflow-hidden rounded-[2rem] border bg-card">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_24rem] lg:p-8">
              <div>
                <Badge variant="outline" className="mb-4">Attendance MVP</Badge>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">Daily Site Attendance</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review check-ins, location evidence, selfies, missing checkouts, and manual corrections from one daily desk.
                </p>
              </div>
              <div className="rounded-3xl border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3Icon className="size-4" />
                  Embed POS Link
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">{posUrl || "Loading workspace link..."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copyPosUrl()} disabled={!posUrl}>Copy Link</Button>
                  <Button variant="outline" size="sm" asChild disabled={!posUrl}>
                    <a href={posUrl} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                      Open POS
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-[16rem_1fr]">
            <div className="rounded-3xl border bg-card p-4">
              <Label htmlFor="attendance-date">Attendance date</Label>
              <Input id="attendance-date" type="date" className="mt-2" value={date} onChange={(event) => setDate(event.target.value)} />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void fetchAttendance()}>
                  <RefreshCwIcon />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <DownloadIcon />
                  CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {summaryCards.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-3xl border bg-card p-5">
                  <Icon className="size-5 text-muted-foreground" />
                  <p className="mt-4 text-3xl font-semibold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border bg-card">
            <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Attendance Records</h2>
                <p className="text-sm text-muted-foreground">Selfies and map links are shown when the POS captured them.</p>
              </div>
              <Button onClick={() => setManualOpen(true)}>
                <PlusIcon />
                Add Manual Attendance
              </Button>
            </div>
            {loading ? (
              <div className="grid gap-3 p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : (
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
                      <TableCell>{formatTime(record.checkInAt)}</TableCell>
                      <TableCell>{formatTime(record.checkOutAt)}</TableCell>
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
            )}
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="text-xl font-semibold">Absent Employees</h2>
            <p className="mt-1 text-sm text-muted-foreground">Active employees without a record for the selected date.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(data?.absentEmployees ?? []).map((employee) => (
                <Badge key={employee._id} variant="outline" className="rounded-full px-3 py-1">
                  {employee.fullName}{employee.employeeCode ? ` · ${employee.employeeCode}` : ""}
                </Badge>
              ))}
              {data?.absentEmployees.length === 0 && <p className="text-sm text-muted-foreground">No absent employees.</p>}
            </div>
          </section>
        </div>
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
    </AppLayout>
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
