import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BarChart3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  WrenchIcon,
} from "lucide-react"

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
  serviceFetch,
  siteCity,
  statusLabel,
  SYSTEM_CATEGORY_LABELS,
  useOrganizationRefresh,
  type EmployeeOption,
  type ServiceListResponse,
  type ServicePriority,
  type ServiceRequest,
  type ServiceSettingsResponse,
  type ServiceStatus,
  type ServiceSystemCategory,
} from "@/lib/service-management"

const PAGE_LIMIT = 20
const ALL = "__all__"

function priorityVariant(priority: ServicePriority) {
  if (priority === "critical") return "destructive" as const
  if (priority === "high") return "default" as const
  return "outline" as const
}

function statusVariant(status: ServiceSystemCategory) {
  if (status === "closed" || status === "resolved") return "secondary" as const
  if (status === "cancelled") return "outline" as const
  return "default" as const
}

export default function ServiceRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [owners, setOwners] = useState<EmployeeOption[]>([])
  const [statuses, setStatuses] = useState<ServiceStatus[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [city, setCity] = useState(ALL)
  const [owner, setOwner] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_LIMIT),
    })
    if (query) params.set("search", query)
    params.set("systemCategory", status === ALL ? "open,waiting" : status)
    if (priority !== ALL) params.set("priority", priority)
    if (city !== ALL) params.set("city", city)
    if (owner !== ALL) params.set("assignedEmployeeId", owner)
    try {
      const data = await serviceFetch<ServiceListResponse>(
        `/requests?${params}`
      )
      const items = data.items ?? data.requests ?? []
      setRequests(items)
      setTotal(data.total ?? items.length)
      setTotalPages(Math.max(1, data.totalPages ?? 1))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load service requests"
      )
    } finally {
      setLoading(false)
    }
  }, [city, owner, page, priority, query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

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
      .then(([employeeData, settingsData]) => {
        setOwners(employeeData.employees ?? [])
        setStatuses(settingsData.statuses ?? [])
      })
      .catch(() => undefined)
  }, [revision])

  const resetForOrganization = useCallback(() => {
    setRequests([])
    setOwners([])
    setStatuses([])
    setPage(1)
    setRevision((value) => value + 1)
  }, [])
  useOrganizationRefresh(resetForOrganization)

  const cities = useMemo(
    () =>
      [
        ...new Set(requests.map(siteCity).filter((city) => city !== "—")),
      ].sort(),
    [requests]
  )
  const visible = total
    ? `${(page - 1) * PAGE_LIMIT + 1}–${Math.min(page * PAGE_LIMIT, total)}`
    : "0"

  return (
    <AppLayout>
      <SiteHeader />
      <div className="flex min-h-0 flex-1 flex-col">
        <PageToolbar
          icon={WrenchIcon}
          title="Active Requests"
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
                <span className="sr-only">Refresh</span>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/service/summary">
                  <BarChart3Icon />
                  Summary
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/service/new">
                  <PlusIcon />
                  New SR
                </Link>
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2.5">
          <div className="relative min-w-64 flex-1">
            <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SR, customer, equipment, complaint..."
              className="h-8 pl-9"
            />
          </div>
          <Filter value={status} onChange={setStatus} label="Status">
            {Object.entries(SYSTEM_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={priority} onChange={setPriority} label="Priority">
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={city} onChange={setCity} label="City">
            {cities.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={owner} onChange={setOwner} label="Owner">
            {owners.map((value) => (
              <SelectItem key={value._id} value={value._id}>
                {value.fullName}
              </SelectItem>
            ))}
          </Filter>
          <span className="ml-auto text-xs text-muted-foreground">
            {visible} of {total}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : loading ? (
            <ListSkeleton rows={10} columns={10} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={WrenchIcon}
              title="No service requests found"
              description="Adjust the filters or log a new service request."
              action={
                <Button asChild size="sm">
                  <Link to="/service/new">
                    <PlusIcon />
                    New SR
                  </Link>
                </Button>
              }
            />
          ) : (
            <table className="w-full min-w-[1420px] text-xs">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b bg-muted/50 text-left text-[10px] tracking-wider text-muted-foreground uppercase">
                  {[
                    "SR",
                    "Date",
                    "Customer",
                    "City",
                    "Equipment",
                    "Complaint",
                    "Priority",
                    "Status",
                    "Owner",
                    "Last activity",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request._id}
                    className="cursor-pointer border-b hover:bg-muted/35"
                    onClick={() =>
                      void navigate({
                        to: "/service/$requestId",
                        params: { requestId: request._id },
                      })
                    }
                  >
                    <td className="px-3 py-2.5 font-mono font-bold">
                      {requestNumber(request)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5 font-medium">
                      {customerName(request)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {siteCity(request)}
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5">
                      {equipmentName(request)}
                    </td>
                    <td className="max-w-72 px-3 py-2.5">
                      <p className="truncate font-medium">{request.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {request.complaintType || request.description}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={priorityVariant(request.priority)}>
                        {PRIORITY_LABELS[request.priority] ?? request.priority}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusVariant(request.systemCategory)}>
                        {statusLabel(request, statuses)}
                      </Badge>
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5">
                      {referenceName(request.engineerId, "Unassigned")}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(
                        request.lastActivityAt ?? request.updatedAt
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Filter({
  value,
  onChange,
  label,
  children,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  )
}
