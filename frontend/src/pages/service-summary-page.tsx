import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  DownloadIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/list-states"
import { PageToolbar } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate, formatDateTime } from "@/lib/format"
import {
  coreApiFetch,
  customerName,
  equipmentName,
  PRIORITY_LABELS,
  referenceName,
  requestNumber,
  SERVICE_API_BASE,
  serviceFetch,
  siteCity,
  statusLabel,
  SYSTEM_CATEGORY_LABELS,
  useOrganizationRefresh,
  type CustomerOption,
  type EmployeeOption,
  type ServicePriority,
  type ServiceRequest,
  type ServiceSettingsResponse,
  type ServiceStatus,
} from "@/lib/service-management"

const ALL = "__all__"
const today = () => new Date().toISOString().slice(0, 10)
const monthAgo = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().slice(0, 10)
}

export default function ServiceSummaryPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ServiceRequest[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [owners, setOwners] = useState<EmployeeOption[]>([])
  const [statuses, setStatuses] = useState<ServiceStatus[]>([])
  const [total, setTotal] = useState(0)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [city, setCity] = useState(ALL)
  const [customer, setCustomer] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [owner, setOwner] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to, page: "1", limit: "100" })
    if (city !== ALL) params.set("city", city)
    if (customer !== ALL) params.set("customerId", customer)
    params.set(
      "systemCategory",
      status === ALL ? "open,waiting,resolved,closed,cancelled" : status
    )
    if (priority !== ALL) params.set("priority", priority)
    if (owner !== ALL) params.set("assignedEmployeeId", owner)
    return params
  }, [city, customer, from, owner, priority, status, to])

  const load = useCallback(async () => {
    try {
      const data = await serviceFetch<{
        requests: ServiceRequest[]
        rows: ServiceRequest[]
        total: number
      }>(`/summary?${query}`)
      const requests = data.rows ?? data.requests ?? []
      setRows(requests)
      setTotal(data.total ?? requests.length)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load service summary"
      )
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, revision])
  useEffect(() => {
    Promise.all([
      coreApiFetch<{ customers?: CustomerOption[] }>(
        "/api/v1/customers?limit=100"
      ),
      coreApiFetch<{ employees?: EmployeeOption[] }>(
        "/api/v1/employees?limit=100"
      ),
      serviceFetch<ServiceSettingsResponse>("/settings"),
    ])
      .then(([customerData, employeeData, settingsData]) => {
        setCustomers(customerData.customers ?? [])
        setOwners(employeeData.employees ?? [])
        setStatuses(settingsData.statuses ?? [])
      })
      .catch(() => undefined)
  }, [revision])

  const resetForOrganization = useCallback(() => {
    setRows([])
    setCustomers([])
    setOwners([])
    setStatuses([])
    setTotal(0)
    setRevision((value) => value + 1)
  }, [])
  useOrganizationRefresh(resetForOrganization)

  const cities = useMemo(
    () =>
      [...new Set(rows.map(siteCity).filter((city) => city !== "—"))].sort(),
    [rows]
  )

  async function exportCsv() {
    try {
      const response = await fetch(
        `${SERVICE_API_BASE}/summary/export?${query}`,
        {
          credentials: "include",
        }
      )
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? data?.message ?? "Export failed")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `service-summary-${from}-${to}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download CSV")
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Service", href: "/service" },
          { label: "Summary" },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <PageToolbar
          leading={
            <Button asChild variant="ghost" size="icon-sm">
              <Link to="/service">
                <ArrowLeftIcon />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
          }
          icon={WrenchIcon}
          title="Service Summary"
          count={loading ? null : total}
          actions={
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setLoading(true)
                  void load()
                }}
              >
                <RefreshCwIcon className={loading ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportCsv()}
              >
                <DownloadIcon />
                Download CSV
              </Button>
            </>
          }
        />
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/20 px-4 py-3">
          <DateFilter label="From" value={from} onChange={setFrom} />
          <DateFilter label="To" value={to} onChange={setTo} />
          <Filter label="City" value={city} onChange={setCity}>
            {cities.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Filter>
          <Filter label="Customer" value={customer} onChange={setCustomer}>
            {customers.map((value) => (
              <SelectItem key={value._id} value={value._id}>
                {value.name || value.company || "Unnamed customer"}
              </SelectItem>
            ))}
          </Filter>
          <Filter label="Status" value={status} onChange={setStatus}>
            {Object.entries(SYSTEM_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </Filter>
          <Filter label="Priority" value={priority} onChange={setPriority}>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </Filter>
          <Filter label="Owner" value={owner} onChange={setOwner}>
            {owners.map((value) => (
              <SelectItem key={value._id} value={value._id}>
                {value.fullName}
              </SelectItem>
            ))}
          </Filter>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : loading ? (
            <ListSkeleton rows={12} columns={9} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={WrenchIcon}
              title="No requests in this period"
              description="Change the date range or filters to expand the overview."
            />
          ) : (
            <table className="w-full min-w-[1300px] text-xs">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b bg-muted/50 text-left text-[10px] tracking-wider text-muted-foreground uppercase">
                  {[
                    "SR",
                    "Opened",
                    "Customer / city",
                    "Equipment",
                    "Complaint",
                    "Priority",
                    "Status",
                    "Owner",
                    "Last activity",
                  ].map((value) => (
                    <th key={value} className="px-3 py-2 font-semibold">
                      {value}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    className="cursor-pointer border-b hover:bg-muted/35"
                    onClick={() =>
                      void navigate({
                        to: "/service/$requestId",
                        params: { requestId: row._id },
                      })
                    }
                  >
                    <td className="px-3 py-2.5 font-mono font-bold">
                      {requestNumber(row)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="max-w-52 px-3 py-2.5">
                      <p className="truncate font-medium">
                        {customerName(row)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {siteCity(row)}
                      </p>
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5">
                      {equipmentName(row)}
                    </td>
                    <td className="max-w-72 px-3 py-2.5">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.complaintType}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          row.priority === "critical"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {PRIORITY_LABELS[row.priority as ServicePriority] ??
                          row.priority}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">
                        {statusLabel(row, statuses)}
                      </Badge>
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5">
                      {referenceName(row.engineerId, "Unassigned")}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.lastActivityAt ?? row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {label}
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-36 text-xs"
      />
    </label>
  )
}
function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-36 text-xs normal-case">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label}</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </label>
  )
}
