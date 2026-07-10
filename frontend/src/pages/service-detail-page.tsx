import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FileIcon,
  HistoryIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  Settings2Icon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
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
import { Spinner } from "@/components/ui/spinner"
import { formatDate, formatDateTime } from "@/lib/format"
import {
  coreApiFetch,
  customerName,
  equipmentName,
  openServiceAttachment,
  PRIORITY_LABELS,
  requestNumber,
  serviceFetch,
  siteCity,
  siteName,
  statusLabel,
  uploadServiceAttachment,
  useOrganizationRefresh,
  type EmployeeOption,
  type ServicePriority,
  type ServiceRecord,
  type ServiceRecordType,
  type ServiceRequest,
  type ServiceSettingsResponse,
} from "@/lib/service-management"

const NONE = "__none__"
const RECORD_TYPES: ServiceRecordType[] = [
  "service_visit",
  "spare_dispatch",
  "root_cause_analysis",
]
const RECORD_LABELS: Record<ServiceRecordType, string> = {
  service_visit: "Service visit",
  spare_dispatch: "Spare dispatch",
  root_cause_analysis: "Root cause analysis",
}

interface ServiceDetailResponse {
  item: ServiceRequest
  request: ServiceRequest
  activities: ServiceRequest["activities"]
  records: ServiceRequest["records"]
  attachments: ServiceRequest["attachments"]
  tickets: ServiceRequest["tickets"]
}

export default function ServiceDetailPage() {
  const { requestId } = useParams({ from: "/service_/$requestId" })
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [settings, setSettings] = useState<ServiceSettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordType, setRecordType] =
    useState<ServiceRecordType>("service_visit")
  const [recordTitle, setRecordTitle] = useState("")
  const [recordDetails, setRecordDetails] = useState("")
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [waiver, setWaiver] = useState("")
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    try {
      const data = await serviceFetch<ServiceDetailResponse>(
        `/requests/${requestId}`
      )
      const item = data.request ?? data.item
      setRequest({
        ...item,
        activities: data.activities ?? item.activities ?? [],
        records: data.records ?? item.records ?? [],
        attachments: data.attachments ?? item.attachments ?? [],
        tickets: data.tickets ?? item.tickets ?? [],
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load service request"
      )
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, revision])
  useEffect(() => {
    Promise.all([
      coreApiFetch<{ employees?: EmployeeOption[] }>(
        "/api/v1/employees?limit=100"
      ),
      serviceFetch<ServiceSettingsResponse>("/settings"),
    ])
      .then(([employeeData, settingData]) => {
        setEmployees(employeeData.employees ?? [])
        setSettings(settingData)
      })
      .catch(() => undefined)
  }, [revision])

  const resetForOrganization = useCallback(() => {
    setRequest(null)
    setEmployees([])
    setSettings(null)
    setLoading(true)
    setRevision((value) => value + 1)
  }, [])
  useOrganizationRefresh(resetForOrganization)

  async function act(
    key: string,
    action: () => Promise<unknown>,
    message: string
  ) {
    setBusy(key)
    try {
      await action()
      toast.success(message)
      await load()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  async function addNote() {
    if (!note.trim()) return
    const value = note.trim()
    const success = await act(
      "note",
      () =>
        serviceFetch(`/requests/${requestId}/activities`, {
          method: "POST",
          body: JSON.stringify({ action: "note_added", message: value }),
        }),
      "Activity added"
    )
    if (success) setNote("")
  }

  async function upload(file: File | null) {
    if (!file) return
    await act(
      "upload",
      async () => {
        await uploadServiceAttachment(requestId, file)
      },
      "Attachment added"
    )
  }

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Service", href: "/service" },
            { label: "Request" },
          ]}
        />
        <div className="space-y-4 p-6">
          <Skeleton className="h-9 w-72" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    )
  }
  if (error || !request) {
    return (
      <AppLayout>
        <SiteHeader />
        <ErrorState
          message={error ?? "Service request not found"}
          onRetry={() => void load()}
        />
      </AppLayout>
    )
  }

  const isClosed =
    request.systemCategory === "closed" ||
    request.systemCategory === "cancelled"
  const statuses = (settings?.statuses ?? [])
    .filter((status) => status.isActive)
    .sort((a, b) => a.order - b.order)
  const activities = request.activities ?? []
  const records = request.records ?? []
  const attachments =
    request.attachments ?? activities.flatMap((item) => item.attachments ?? [])

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Service", href: "/service" },
          { label: requestNumber(request) },
        ]}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1500px] space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link to="/service">
                  <ArrowLeftIcon />
                  Back to requests
                </Link>
              </Button>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded border bg-muted px-2 py-1 font-mono text-xs font-bold">
                  {requestNumber(request)}
                </span>
                <Badge>{statusLabel(request, statuses)}</Badge>
                <Badge
                  variant={
                    request.priority === "critical" ? "destructive" : "outline"
                  }
                >
                  {PRIORITY_LABELS[request.priority] ?? request.priority}
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                {request.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {customerName(request)}
                {siteCity(request) !== "—" ? ` · ${siteCity(request)}` : ""} ·
                opened {formatDate(request.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {request.systemCategory === "resolved" && (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(
                      "reopen",
                      () =>
                        serviceFetch(`/requests/${requestId}/reopen`, {
                          method: "POST",
                          body: "{}",
                        }),
                      "Request reopened"
                    )
                  }
                >
                  <RotateCcwIcon />
                  Reopen
                </Button>
              )}
              {isClosed ? (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void act(
                      "reopen",
                      () =>
                        serviceFetch(`/requests/${requestId}/reopen`, {
                          method: "POST",
                          body: "{}",
                        }),
                      "Request reopened"
                    )
                  }
                >
                  <RotateCcwIcon />
                  Reopen
                </Button>
              ) : (
                <Button
                  disabled={busy !== null}
                  onClick={() => setCloseOpen(true)}
                >
                  <CheckCircle2Icon />
                  Close request
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Panel icon={WrenchIcon} title="Request overview">
                <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
                  <Detail label="Customer" value={customerName(request)} />
                  <Detail label="Site" value={siteName(request)} />
                  <Detail label="City" value={siteCity(request)} />
                  <Detail label="Equipment" value={equipmentName(request)} />
                  <Detail
                    label="Complaint type"
                    value={request.complaintType || "—"}
                  />
                  <Detail
                    label="Created"
                    value={formatDateTime(request.createdAt)}
                  />
                </div>
                {request.description && (
                  <div className="border-t px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {request.description}
                  </div>
                )}
              </Panel>

              <Panel
                icon={ClipboardListIcon}
                title="Service records"
                action={
                  !isClosed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecordOpen(true)}
                    >
                      <PlusIcon />
                      New record
                    </Button>
                  )
                }
              >
                {records.length === 0 ? (
                  <EmptyLine text="No service records created." />
                ) : (
                  <div className="divide-y">
                    {records.map((record) => (
                      <RecordRow
                        key={record._id}
                        record={record}
                        busy={busy !== null}
                        onSave={(updates) =>
                          void act(
                            `record-${record._id}`,
                            () =>
                              serviceFetch(
                                `/requests/${requestId}/records/${record._id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify(updates),
                                }
                              ),
                            "Record updated"
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                icon={PaperclipIcon}
                title="Attachments"
                action={
                  !isClosed && (
                    <Label className="cursor-pointer">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium">
                        {busy === "upload" ? (
                          <Spinner />
                        ) : (
                          <PlusIcon className="size-3.5" />
                        )}
                        Add file
                      </span>
                      <Input
                        type="file"
                        className="sr-only"
                        disabled={busy !== null}
                        onChange={(event) => {
                          void upload(event.target.files?.[0] ?? null)
                          event.target.value = ""
                        }}
                      />
                    </Label>
                  )
                }
              >
                {attachments.length === 0 ? (
                  <EmptyLine text="No files attached." />
                ) : (
                  <div className="divide-y">
                    {attachments.map((attachment, index) => (
                      <button
                        key={
                          attachment.id ??
                          attachment._id ??
                          `${attachment.key}-${index}`
                        }
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/30"
                        onClick={() =>
                          void openServiceAttachment(
                            requestId,
                            attachment
                          ).catch((err) =>
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Unable to open file"
                            )
                          )
                        }
                      >
                        <FileIcon className="size-4 text-muted-foreground" />
                        <span className="flex-1 truncate font-medium">
                          {attachment.originalName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(attachment.size)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel icon={Settings2Icon} title="Control">
                <div className="grid gap-4 p-4">
                  <Control label="Status">
                    <Select
                      value={request.statusId}
                      disabled={
                        busy !== null ||
                        ["resolved", "closed", "cancelled"].includes(
                          request.systemCategory
                        )
                      }
                      onValueChange={(value) =>
                        void act(
                          "status",
                          () =>
                            serviceFetch(`/requests/${requestId}/status`, {
                              method: "PATCH",
                              body: JSON.stringify({ statusId: value }),
                            }),
                          "Status updated"
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses
                          .filter(
                            (status) => status.systemCategory !== "closed"
                          )
                          .map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Control>
                  <Control label="Priority">
                    <Select
                      value={request.priority}
                      disabled={busy !== null || isClosed}
                      onValueChange={(value) =>
                        void act(
                          "priority",
                          () =>
                            serviceFetch(`/requests/${requestId}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                priority: value as ServicePriority,
                              }),
                            }),
                          "Priority updated"
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Control>
                  <EmployeeControl
                    label="Coordinator"
                    value={refId(request.coordinatorId)}
                    employees={employees}
                    disabled={busy !== null || isClosed}
                    onChange={(value) =>
                      void act(
                        "coordinator",
                        () =>
                          serviceFetch(`/requests/${requestId}/assignment`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              coordinatorId: value === NONE ? null : value,
                              engineerId: nullableRefId(request.engineerId),
                            }),
                          }),
                        "Coordinator updated"
                      )
                    }
                  />
                  <EmployeeControl
                    label="Engineer"
                    value={refId(request.engineerId)}
                    employees={employees}
                    disabled={busy !== null || isClosed}
                    onChange={(value) =>
                      void act(
                        "engineer",
                        () =>
                          serviceFetch(`/requests/${requestId}/assignment`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              coordinatorId: nullableRefId(
                                request.coordinatorId
                              ),
                              engineerId: value === NONE ? null : value,
                            }),
                          }),
                        "Engineer updated"
                      )
                    }
                  />
                </div>
              </Panel>

              <Panel icon={HistoryIcon} title="Activity timeline">
                {!isClosed && (
                  <div className="border-b p-3">
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Add diagnostic note, visit update, or customer communication..."
                      className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        disabled={!note.trim() || busy !== null}
                        onClick={() => void addNote()}
                      >
                        {busy === "note" ? <Spinner /> : <SendIcon />}Add
                        activity
                      </Button>
                    </div>
                  </div>
                )}
                {activities.length === 0 ? (
                  <EmptyLine text="No activity yet." />
                ) : (
                  <div className="max-h-[560px] divide-y overflow-y-auto">
                    {[...activities].reverse().map((activity) => (
                      <div
                        key={activity._id}
                        className="relative px-4 py-3 pl-8 before:absolute before:top-4 before:left-4 before:size-2 before:rounded-full before:bg-primary"
                      >
                        <p className="text-sm leading-snug">
                          {activity.message ?? activity.note ?? activity.action}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {activity.actorName ? `${activity.actorName} · ` : ""}
                          {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create service record</DialogTitle>
            <DialogDescription>
              Record a service visit, spare dispatch, or root-cause analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Control label="Record type">
              <Select
                value={recordType}
                onValueChange={(value) =>
                  setRecordType(value as ServiceRecordType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {RECORD_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>
            <Control label="Title">
              <Input
                value={recordTitle}
                onChange={(event) => setRecordTitle(event.target.value)}
                placeholder="Site visit findings"
              />
            </Control>
            <Control label="Details">
              <textarea
                value={recordDetails}
                onChange={(event) => setRecordDetails(event.target.value)}
                rows={6}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Control>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!recordTitle.trim() || busy !== null}
              onClick={() =>
                void act(
                  "record",
                  () =>
                    serviceFetch(`/requests/${requestId}/records`, {
                      method: "POST",
                      body: JSON.stringify({
                        type: recordType,
                        title: recordTitle,
                        description: recordDetails,
                      }),
                    }),
                  "Record created"
                ).then((success) => {
                  if (success) {
                    setRecordOpen(false)
                    setRecordTitle("")
                    setRecordDetails("")
                  }
                })
              }
            >
              Create record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close service request</DialogTitle>
            <DialogDescription>
              Record customer confirmation. If confirmation is unavailable, a
              specific waiver reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Control label="Confirmation details">
              <textarea
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                rows={4}
                placeholder="Confirmed by, date, method, and outcome..."
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Control>
            <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              OR WAIVE
            </div>
            <Control label="Waiver reason">
              <textarea
                value={waiver}
                onChange={(event) => setWaiver(event.target.value)}
                rows={3}
                placeholder="Why customer confirmation cannot be obtained..."
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Control>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                (!confirmation.trim() && !waiver.trim()) || busy !== null
              }
              onClick={() =>
                void act(
                  "close",
                  () =>
                    serviceFetch(`/requests/${requestId}/close`, {
                      method: "POST",
                      body: JSON.stringify({
                        confirmedByCustomer: Boolean(confirmation.trim()),
                        confirmationNote: confirmation.trim() || null,
                        waiverReason: waiver.trim() || null,
                      }),
                    }),
                  "Request closed"
                ).then((success) => {
                  if (success) setCloseOpen(false)
                })
              }
            >
              {busy === "close" && <Spinner />}Confirm closure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof WrenchIcon
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-11 items-center justify-between border-b bg-muted/25 px-4 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </span>
        {action}
      </div>
      {children}
    </section>
  )
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
function Control({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
function EmployeeControl({
  label,
  value,
  employees,
  disabled,
  onChange,
}: {
  label: string
  value: string
  employees: EmployeeOption[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Control label={label}>
      <Select
        value={value || NONE}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {employees.map((employee) => (
            <SelectItem key={employee._id} value={employee._id}>
              {employee.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Control>
  )
}
function RecordRow({
  record,
  busy,
  onSave,
}: {
  record: ServiceRecord
  busy: boolean
  onSave: (updates: Partial<ServiceRecord>) => void
}) {
  const [details, setDetails] = useState(record.description ?? "")
  return (
    <div className="grid gap-2 px-4 py-3 md:grid-cols-[90px_minmax(0,1fr)_140px]">
      <div>
        <Badge variant="outline">{RECORD_LABELS[record.type]}</Badge>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {record.reference}
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold">
          {record.title || `${record.type} record`}
        </p>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={2}
          className="mt-1 w-full resize-y rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-end justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || details === (record.description ?? "")}
          onClick={() => onSave({ description: details })}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
function EmptyLine({ text }: { text: string }) {
  return <p className="p-6 text-center text-sm text-muted-foreground">{text}</p>
}
function refId(value: ServiceRequest["engineerId"]) {
  return !value ? NONE : typeof value === "string" ? value : value._id
}
function nullableRefId(value: ServiceRequest["engineerId"]) {
  const valueId = refId(value)
  return valueId === NONE ? null : valueId
}
function formatBytes(value: number) {
  if (!value) return "—"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
